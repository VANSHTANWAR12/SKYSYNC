import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import FlightInfo from "../components/FlightInfo";
import FlightMap from "../components/FlightMap";
import AgentPanel from "../components/AgentPanel";
import EventFeed from "../components/EventFeed";
import { fetchLiveFlights } from "../services/flights";
import { fetchWeatherThreats } from "../services/weather";
import { fetchAgentStatus } from "../services/agents";

function formatUtcTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function formatEventTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function buildEvents(flightCount, weatherSummary, agentData, apiStatus) {
  const time = formatEventTime(new Date());
  const events = [];

  if (apiStatus.flightLoaded) {
    events.push({ level: "INFO", message: "Flight Loaded", time });
  } else if (apiStatus.flightError) {
    events.push({ level: "ALERT", message: "Flight Data Unavailable", time });
  }

  if (apiStatus.weatherLoaded) {
    events.push({ level: "INFO", message: "Weather Scan Complete", time });
  } else if (apiStatus.weatherError) {
    events.push({ level: "ALERT", message: "Weather Data Unavailable", time });
  }

  if (weatherSummary.criticalThreats > 0) {
    events.push({ level: "ALERT", message: "Critical Storm Zone", time });
  } else if (weatherSummary.highThreats > 0) {
    events.push({ level: "WARNING", message: "Heavy Rain Detected", time });
  }

  if (agentData?.trafficAgent?.congestionLevel === "HIGH") {
    events.push({ level: "ALERT", message: "Route Risk Detected", time });
  }

  if (flightCount > 0) {
    events.push({ level: "INFO", message: "Alternative Route Generated", time });
  }

  return events;
}

function Dashboard() {
  const [utcTime, setUtcTime] = useState(() => formatUtcTime(new Date()));
  const [flights, setFlights] = useState([]);
  const [flightError, setFlightError] = useState("");
  const [flightLoading, setFlightLoading] = useState(true);
  const [weatherSummary, setWeatherSummary] = useState({ maxRisk: 0, totalThreats: 0, highThreats: 0, criticalThreats: 0 });
  const [weatherThreats, setWeatherThreats] = useState([]);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [agentData, setAgentData] = useState({ weatherAgent: null, trafficAgent: null, trafficZones: [] });
  const [agentError, setAgentError] = useState("");
  const [agentLoading, setAgentLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setUtcTime(formatUtcTime(new Date()));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadFlights = async () => {
      setFlightLoading(true);
      setFlightError("");

      try {
        const data = await fetchLiveFlights(controller.signal);
        if (!mounted) {
          return;
        }
        setFlights(data);
      } catch (error) {
        if (!mounted || error?.name === "AbortError") {
          return;
        }
        console.error("Failed to load live flight data:", error);
        setFlightError(error instanceof Error ? error.message : "Failed to load live flights");
        setFlights([]);
      } finally {
        if (mounted) {
          setFlightLoading(false);
        }
      }
    };

    loadFlights();
    const timer = window.setInterval(loadFlights, 30000);

    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadWeather = async () => {
      setWeatherLoading(true);
      setWeatherError("");

      try {
        const data = await fetchWeatherThreats(controller.signal);
        if (!mounted) {
          return;
        }
        setWeatherThreats(data.threats);
        setWeatherSummary(data.summary);
      } catch (error) {
        if (!mounted || error?.name === "AbortError") {
          return;
        }
        console.error("Failed to load weather data:", error);
        setWeatherError(error instanceof Error ? error.message : "Failed to load weather");
        setWeatherThreats([]);
        setWeatherSummary({ maxRisk: 0, totalThreats: 0, highThreats: 0, criticalThreats: 0 });
      } finally {
        if (mounted) {
          setWeatherLoading(false);
        }
      }
    };

    loadWeather();
    const timer = window.setInterval(loadWeather, 10 * 60 * 1000);

    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadAgents = async () => {
      setAgentLoading(true);
      setAgentError("");

      try {
        const data = await fetchAgentStatus(controller.signal);
        if (!mounted) {
          return;
        }
        setAgentData(data);
      } catch (error) {
        if (!mounted || error?.name === "AbortError") {
          return;
        }
        console.error("Failed to load agent data:", error);
        setAgentError(error instanceof Error ? error.message : "Failed to load agent data");
        setAgentData({ weatherAgent: null, trafficAgent: null, trafficZones: [] });
      } finally {
        if (mounted) {
          setAgentLoading(false);
        }
      }
    };

    loadAgents();
    const timer = window.setInterval(loadAgents, 60 * 1000);

    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const selectedFlight = flights[0] || null;
  const agents = useMemo(
    () => ({
      weatherAgent: agentData.weatherAgent,
      trafficAgent: agentData.trafficAgent,
      weatherLoading,
      flightLoading,
      agentLoading,
      agentError,
    }),
    [agentData, weatherLoading, flightLoading, agentLoading, agentError],
  );
  const events = useMemo(
    () =>
      buildEvents(flights.length, weatherSummary, agentData, {
        flightLoaded: flights.length > 0,
        flightError,
        weatherLoaded: !weatherLoading,
        weatherError,
      }),
    [flights.length, flightError, weatherLoading, weatherError, weatherSummary, agentData],
  );

  return (
    <div className="dashboard-shell">
      <Header utcTime={utcTime} systemStatus={flightError || weatherError || agentError ? "Degraded" : "Operational"} />

      <main className="dashboard-layout">
        <FlightInfo
          flight={selectedFlight}
          loading={flightLoading}
          error={flightError}
          flightCount={flights.length}
        />
        <FlightMap
          flights={flights}
          weatherThreats={weatherThreats}
          trafficZones={agentData.trafficZones || []}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
        />
        <AgentPanel agentData={agents} />
      </main>

      <EventFeed events={events} />
    </div>
  );
}

export default Dashboard;
