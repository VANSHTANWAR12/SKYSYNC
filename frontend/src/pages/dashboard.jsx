import { useEffect, useMemo, useState, useCallback } from "react";
import Header from "../components/Header";
import FlightInfo from "../components/FlightInfo";
import FlightMap from "../components/FlightMap";
import AgentPanel from "../components/AgentPanel";
import EventFeed from "../components/EventFeed";
import FleetAnalytics from "../components/FleetAnalytics";
import { fetchLiveFlights } from "../services/flights";
import { fetchWeatherThreats } from "../services/weather";
import { fetchAgentStatus } from "../services/agents";
import { useReroute } from "../hooks/useReroute";
import { computeFlightMetrics } from "../utils/metrics";

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

function Dashboard({ user, onLogout, onOpenAssistant }) {
  const [utcTime, setUtcTime] = useState(() => formatUtcTime(new Date()));
  const [flights, setFlights] = useState([]);
  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [flightError, setFlightError] = useState("");
  const [flightLoading, setFlightLoading] = useState(true);
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(300);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState({ maxRisk: 0, totalThreats: 0, highThreats: 0, criticalThreats: 0 });
  const [weatherThreats, setWeatherThreats] = useState([]);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [agentData, setAgentData] = useState({ weatherAgent: null, trafficAgent: null, navigationAgent: null, trafficZones: [] });
  const [agentError, setAgentError] = useState("");
  const [agentLoading, setAgentLoading] = useState(true);

  // ── B2B Fleet Analytics & Simulation parameters ───────────────────────────
  const [viewMode, setViewMode] = useState("tactical");
  const [simParams, setSimParams] = useState({
    fuelPrice: 1.10,
    carbonTax: 85,
    delayCost: 75,
    holdingTimeMin: 25,
    holdingFuelRate: 25
  });

  const [approvedReroutes, setApprovedReroutes] = useState(() => [
    {
      flightId: "MOCK-PREV-1",
      flightNumber: "AI-204",
      airline: "Air India",
      origin: "DELHI (DEL)",
      destination: "BENGALURU (BLR)",
      originalRoute: {
        totalDistanceKm: 1740,
        estimatedFuelKg: 6090,
        estimatedTimeMin: 123
      },
      alternateRoute: {
        totalDistanceKm: 1890,
        estimatedFuelKg: 6615,
        estimatedTimeMin: 133
      },
      metrics: {
        safetyScore: 94
      },
      approvedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString()
    },
    {
      flightId: "MOCK-PREV-2",
      flightNumber: "6E-551",
      airline: "IndiGo",
      origin: "KOLKATA (CCU)",
      destination: "MUMBAI (BOM)",
      originalRoute: {
        totalDistanceKm: 1660,
        estimatedFuelKg: 5810,
        estimatedTimeMin: 118
      },
      alternateRoute: {
        totalDistanceKm: 1780,
        estimatedFuelKg: 6230,
        estimatedTimeMin: 126
      },
      metrics: {
        safetyScore: 91
      },
      approvedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString()
    }
  ]);

  // ── Reroute hook ──────────────────────────────────────────────────────────
  const {
    rerouteData,
    rerouteStatus,
    agentLog,
    showOriginal,
    setShowOriginal,
    injectStorm,
    approveReroute,
    rejectReroute,
  } = useReroute();

  const adjustedRerouteData = useMemo(() => {
    if (!rerouteData) return null;
    const m = computeFlightMetrics(rerouteData.originalRoute, rerouteData.alternateRoute, simParams);
    return {
      ...rerouteData,
      metrics: {
        ...rerouteData.metrics,
        originalFuelKg: m.origTotalFuel,
        alternateFuelKg: m.altTotalFuel,
        originalTimeMin: m.origTotalTime,
        alternateTimeMin: m.altTotalTime,
        fuelSavingsPercent: Math.round((m.netFuelSaved / m.origTotalFuel) * 1000) / 10,
        netSavings: m.netSavings
      }
    };
  }, [rerouteData, simParams]);

  const handleApproveReroute = useCallback(() => {
    approveReroute();
    if (rerouteData) {
      setApprovedReroutes(prev => {
        if (prev.some(r => r.flightId === rerouteData.flightId)) return prev;
        const flightObj = flights.find(f => f.id === selectedFlightId);
        return [
          ...prev,
          {
            ...rerouteData,
            origin: flightObj?.origin || rerouteData.origin || "Unknown",
            destination: flightObj?.destination || rerouteData.destination || "Unknown",
            approvedAt: new Date().toISOString()
          }
        ];
      });
    }
  }, [approveReroute, rerouteData, flights, selectedFlightId]);

  /**
   * Build a flight context object for the reroute hook —
   * resolving display names to lat/lng coords.
   */
  const handleInjectStorm = () => {
    const flight = flights.find(f => f.id === selectedFlightId);
    if (!flight) return;
    injectStorm(flight);
  };

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
        setAgentData({ weatherAgent: null, trafficAgent: null, navigationAgent: null, trafficZones: [] });
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

  const selectedFlight = useMemo(
    () => flights.find(f => f.id === selectedFlightId) || null,
    [flights, selectedFlightId]
  );

  const handleSelectFlight = useCallback((id) => {
    setSelectedFlightId(prevId => prevId === id ? null : id);
  }, []);
  const handleMouseDownLeft = () => setIsResizingLeft(true);
  const handleMouseDownRight = () => setIsResizingRight(true);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        setLeftWidth(Math.max(280, Math.min(600, e.clientX - 20)));
      }
      if (isResizingRight) {
        setRightWidth(Math.max(280, Math.min(600, window.innerWidth - e.clientX - 20)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const agents = useMemo(
    () => ({
      weatherAgent: agentData.weatherAgent,
      trafficAgent: agentData.trafficAgent,
      navigationAgent: agentData.navigationAgent,
      llm: agentData.llm,
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
      <Header
        utcTime={utcTime}
        systemStatus={flightError || weatherError || agentError ? "Degraded" : "Operational"}
        user={user}
        onLogout={onLogout}
      />

      <div className="dashboard-actions">
        <div className="view-mode-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'tactical' ? 'active' : ''}`}
            onClick={() => setViewMode('tactical')}
          >
            Tactical Flight Deck
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'executive' ? 'active' : ''}`}
            onClick={() => setViewMode('executive')}
          >
            Fleet Business Analytics
          </button>
        </div>

        <button className="open-chat-button" onClick={onOpenAssistant}>
          Open Pilot Assistant
        </button>
      </div>

      {viewMode === "executive" ? (
        <FleetAnalytics
          approvedReroutes={approvedReroutes}
          simParams={simParams}
          setSimParams={setSimParams}
          flights={flights}
        />
      ) : (
        <main 
          className="dashboard-layout" 
          style={{ 
              gridTemplateColumns: `${leftWidth}px 8px 1fr 8px ${rightWidth}px`,
              userSelect: (isResizingLeft || isResizingRight) ? 'none' : 'auto'
          }}
        >
          <FlightInfo
            flight={selectedFlight}
            loading={flightLoading}
            error={flightError}
            flights={flights}
            onSelectFlight={handleSelectFlight}
            weatherThreats={agentData.weatherThreats || []}
            navigationDecisions={agentData.navigationDecisions || []}
          />
          
          <div className={`resizer ${isResizingLeft ? 'resizer--active' : ''}`} onMouseDown={handleMouseDownLeft} />

          <FlightMap
            flights={flights}
            selectedFlightId={selectedFlightId}
            selectedFlight={selectedFlight}
            onSelectFlight={handleSelectFlight}
            weatherThreats={weatherThreats}
            trafficZones={agentData.trafficZones || []}
            weatherLoading={weatherLoading}
            weatherError={weatherError}
            rerouteData={adjustedRerouteData}
            rerouteStatus={rerouteStatus}
            agentLog={agentLog}
            showOriginal={showOriginal}
            onToggleOriginal={setShowOriginal}
            onInjectStorm={handleInjectStorm}
            onApproveReroute={handleApproveReroute}
            onRejectReroute={rejectReroute}
          />

          <div className={`resizer ${isResizingRight ? 'resizer--active' : ''}`} onMouseDown={handleMouseDownRight} />

          <AgentPanel agentData={agents} />
        </main>
      )}

      <EventFeed events={events} />
    </div>
  );
}

export default Dashboard;
