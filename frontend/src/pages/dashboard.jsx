import { useEffect, useMemo, useState, useCallback } from "react";
import Header from "../components/Header";
import FlightInfo from "../components/FlightInfo";
import FlightMap from "../components/FlightMap";
import AgentPanel from "../components/AgentPanel";
import SwarmImpactPanel from "../components/SwarmImpactPanel";
import EventFeed from "../components/EventFeed";
import AgentConsole from "../components/AgentConsole";
import { fetchLiveFlights } from "../services/flights";
import { fetchWeatherThreats } from "../services/weather";
import { fetchAgentStatus } from "../services/agents";
import { useReroute } from "../hooks/useReroute";
import { SWARM_FLIGHTS } from "../utils/swarmFlights";
import { injectStorm as apiInjectStorm } from "../services/reroute";
import { resolveAirportCoords } from "../utils/airportCoords";

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

function buildEvents(flightCount, weatherSummary, agentData, apiStatus, swarmMode, swarmResults) {
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

  if (swarmMode && swarmResults.length > 0) {
    const resolved = swarmResults.filter(r => r.metrics).length;
    events.push({ level: "ALERT", message: `⚡ Swarm Storm: ${resolved}/${swarmResults.length} routes computing`, time });
  } else if (flightCount > 0) {
    events.push({ level: "INFO", message: "Alternative Route Generated", time });
  }

  return events;
}

// ── Swarm concurrent injection ────────────────────────────────────────────────
async function injectSwarmStorm(flight, customStorm, signal) {
  const originCoords = (flight.latitude != null && flight.longitude != null)
    ? [flight.latitude, flight.longitude]
    : (resolveAirportCoords(flight.origin) || [22.0, 78.0]);
  const destinationCoords = resolveAirportCoords(flight.destination) || [13.0827, 80.2707];

  return apiInjectStorm(
    {
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      origin: flight.origin,
      destination: flight.destination,
      originCoords,
      destinationCoords,
      customStorm,
    },
    signal
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Dashboard() {
  const [utcTime, setUtcTime] = useState(() => formatUtcTime(new Date()));
  const [flights, setFlights] = useState([]);
  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [hoveredFlightId, setHoveredFlightId] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [flightError, setFlightError] = useState("");
  const [flightLoading, setFlightLoading] = useState(true);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState({ maxRisk: 0, totalThreats: 0, highThreats: 0, criticalThreats: 0 });
  const [weatherThreats, setWeatherThreats] = useState([]);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [agentData, setAgentData] = useState({ weatherAgent: null, trafficAgent: null, navigationAgent: null, trafficZones: [] });
  const [agentError, setAgentError] = useState("");
  const [agentLoading, setAgentLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // ── Swarm Mode ──────────────────────────────────────────────────────────────
  const [swarmMode, setSwarmMode] = useState(false);
  const [swarmSelectedFlightIds, setSwarmSelectedFlightIds] = useState(() =>
    SWARM_FLIGHTS.map(f => f.id)
  );
  const [customStormCell, setCustomStormCell] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState("summary");
  // swarmResults: array of { id, flightNumber, airline, status, metrics, rerouteData }
  const [swarmResults, setSwarmResults] = useState([]);
  const swarmControllersRef = useState(() => [])[0];

  // ── Single-flight reroute hook ───────────────────────────────────────────────
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  // In swarm mode, overlay swarm flight markers on top of live flights
  const displayFlights = useMemo(() => {
    if (!swarmMode) return flights;
    // Merge swarm flights into the live list (they don't exist in real feed)
    const liveIds = new Set(flights.map(f => f.id));
    const extras = SWARM_FLIGHTS.filter(f => !liveIds.has(f.id));
    return [...flights, ...extras];
  }, [flights, swarmMode]);

  const selectedFlight = useMemo(
    () => displayFlights.find(f => f.id === selectedFlightId) || null,
    [displayFlights, selectedFlightId]
  );

  // ── Toggle swarm mode ────────────────────────────────────────────────────────
  const handleToggleSwarm = useCallback(() => {
    setSwarmMode(prev => {
      const next = !prev;
      // Clear swarm results when turning off
      if (!next) {
        setSwarmResults([]);
        setSwarmSelectedFlightIds(SWARM_FLIGHTS.map(f => f.id));
      }
      setSelectedFlightId(null);
      setHoveredFlightId(null);
      setFocusMode(false);
      setCustomStormCell(null);
      return next;
    });
  }, []);

  const handleToggleSwarmFlight = useCallback((flightId) => {
    setSwarmSelectedFlightIds(prev => {
      if (prev.includes(flightId)) {
        return prev.filter(id => id !== flightId);
      } else {
        if (prev.length >= 5) {
          showToast("Maximum 5 flights can be selected in Swarm Mode.", "warn");
          return prev;
        }
        return [...prev, flightId];
      }
    });
  }, []);

  // ── Single flight storm injection ─────────────────────────────────────────────
  const handleInjectStorm = () => {
    if (swarmMode) {
      handleSwarmInject();
      return;
    }
    const flight = flights.find(f => f.id === selectedFlightId);
    if (!flight) return;
    injectStorm(flight, customStormCell);
  };

  // ── Swarm storm injection — fires all selected flights concurrently ──────────
  const handleSwarmInject = useCallback(async (customStormOverride = undefined) => {
    const activeStorm = customStormOverride !== undefined ? customStormOverride : customStormCell;
    const chosenFlights = displayFlights.filter(f => swarmSelectedFlightIds.includes(f.id));
    if (chosenFlights.length === 0) {
      showToast("Please select at least one flight for Swarm Mode.", "warn");
      return;
    }

    // Abort any in-flight swarm requests
    swarmControllersRef.forEach(c => c.abort());
    swarmControllersRef.length = 0;

    // Initialise results as "loading" for all selected swarm flights
    const initial = chosenFlights.map(f => ({
      id: f.id,
      flightNumber: f.flightNumber,
      airline: f.airline,
      status: "loading",
      metrics: null,
      rerouteData: null,
    }));
    setSwarmResults(initial);

    // Fire all requests concurrently, update state as each resolves
    chosenFlights.forEach(async (flight) => {
      const controller = new AbortController();
      swarmControllersRef.push(controller);

      try {
        const data = await injectSwarmStorm(flight, activeStorm, controller.signal);
        setSwarmResults(prev => prev.map((r) => r.id === flight.id ? {
          ...r,
          status: "active",
          rerouteData: data,
          metrics: {
            fuelDelta: (data.metrics.alternateFuelKg - data.metrics.originalFuelKg),
            timeDelta: (data.metrics.alternateTimeMin - data.metrics.originalTimeMin),
            safetyScore: data.metrics.safetyScore,
          },
        } : r));
      } catch (err) {
        if (err?.name === "AbortError") return;
        setSwarmResults(prev => prev.map((r) => r.id === flight.id ? { ...r, status: "rejected" } : r));
      }
    });
  }, [swarmControllersRef, displayFlights, swarmSelectedFlightIds, customStormCell]);

  // ── Custom Storm Placement Callback ──────────────────────────────────────────
  const handleCustomStormPlaced = useCallback((lat, lng) => {
    const coords = [lat, lng];
    setCustomStormCell(coords);
    showToast(`⛈ Custom storm cell placed at ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E. Recalculating...`);

    if (swarmMode) {
      handleSwarmInject(coords);
    } else {
      const flight = flights.find(f => f.id === selectedFlightId);
      if (flight) {
        injectStorm(flight, coords);
      }
    }
  }, [swarmMode, flights, selectedFlightId, handleSwarmInject, injectStorm]);

  // ── Clear Custom Storm Callback ──────────────────────────────────────────────
  const handleClearStorm = useCallback(() => {
    setCustomStormCell(null);
    showToast("Custom storm cell cleared. Restoring original routes...", "warn");
    if (swarmMode) {
      setSwarmResults([]);
    } else {
      rejectReroute();
    }
  }, [swarmMode, rejectReroute]);

  // ── Approve / reject all swarm reroutes ──────────────────────────────────────
  const handleApproveAll = useCallback(() => {
    setSwarmResults(prev => prev.map(r => r.status === "active" ? { ...r, status: "approved" } : r));
    showToast(`✓ All fleet reroutes approved — ${swarmSelectedFlightIds.length} flights updated`, "success");
  }, [swarmSelectedFlightIds.length]);

  const handleRejectAll = useCallback(() => {
    setSwarmResults([]);
    showToast("Fleet reroutes rejected. Maintaining original flight plans.", "warn");
  }, []);

  const handleApproveFlight = useCallback((flightId) => {
    setSwarmResults(prev => prev.map(r => r.id === flightId ? { ...r, status: "approved" } : r));
    const fl = displayFlights.find(f => f.id === flightId);
    showToast(`✓ Reroute approved for Flight ${fl?.flightNumber || ""}`);
  }, [displayFlights]);

  const handleRejectFlight = useCallback((flightId) => {
    setSwarmResults(prev => prev.map(r => r.id === flightId ? { ...r, status: "rejected", metrics: null, rerouteData: null } : r));
    const fl = displayFlights.find(f => f.id === flightId);
    showToast(`Reroute rejected for Flight ${fl?.flightNumber || ""}. Maintaining original plan.`, "warn");
  }, [displayFlights]);

  // ── Toast helper ──────────────────────────────────────────────────────────────
  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  const handleApproveReroute = () => {
    approveReroute();
    showToast(`Reroute Approved ✓ Flight ${selectedFlight?.flightNumber || ""} updated`);
  };

  // ── Clock ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => setUtcTime(formatUtcTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // ── Live flights ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadFlights = async () => {
      setFlightLoading(true);
      setFlightError("");
      try {
        const data = await fetchLiveFlights(controller.signal);
        if (mounted) setFlights(data);
      } catch (error) {
        if (!mounted || error?.name === "AbortError") return;
        setFlightError(error instanceof Error ? error.message : "Failed to load live flights");
        setFlights([]);
      } finally {
        if (mounted) setFlightLoading(false);
      }
    };

    loadFlights();
    const timer = window.setInterval(loadFlights, 30000);
    return () => { mounted = false; controller.abort(); window.clearInterval(timer); };
  }, []);

  // ── Weather ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadWeather = async () => {
      setWeatherLoading(true);
      setWeatherError("");
      try {
        const data = await fetchWeatherThreats(controller.signal);
        if (mounted) { setWeatherThreats(data.threats); setWeatherSummary(data.summary); }
      } catch (error) {
        if (!mounted || error?.name === "AbortError") return;
        setWeatherError(error instanceof Error ? error.message : "Failed to load weather");
        setWeatherThreats([]);
        setWeatherSummary({ maxRisk: 0, totalThreats: 0, highThreats: 0, criticalThreats: 0 });
      } finally {
        if (mounted) setWeatherLoading(false);
      }
    };

    loadWeather();
    const timer = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => { mounted = false; controller.abort(); window.clearInterval(timer); };
  }, []);

  // ── Agents ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadAgents = async () => {
      setAgentLoading(true);
      setAgentError("");
      try {
        const data = await fetchAgentStatus(controller.signal);
        if (mounted) setAgentData(data);
      } catch (error) {
        if (!mounted || error?.name === "AbortError") return;
        setAgentError(error instanceof Error ? error.message : "Failed to load agent data");
        setAgentData({ weatherAgent: null, trafficAgent: null, navigationAgent: null, trafficZones: [] });
      } finally {
        if (mounted) setAgentLoading(false);
      }
    };

    loadAgents();
    const timer = window.setInterval(loadAgents, 60 * 1000);
    return () => { mounted = false; controller.abort(); window.clearInterval(timer); };
  }, []);

  // ── Resize ───────────────────────────────────────────────────────────────────
  const handleMouseDownLeft  = () => setIsResizingLeft(true);
  const handleMouseDownRight = () => setIsResizingRight(true);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft)  setLeftWidth(Math.max(280, Math.min(600, e.clientX - 20)));
      if (isResizingRight) setRightWidth(Math.max(280, Math.min(600, window.innerWidth - e.clientX - 20)));
    };
    const handleMouseUp = () => { setIsResizingLeft(false); setIsResizingRight(false); };
    if (isResizingLeft || isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);



  const handleSelectFlight = useCallback((id) => {
    setSelectedFlightId(prevId => {
      const next = prevId === id ? null : id;
      if (!next) setFocusMode(false);
      return next;
    });
  }, []);

  const agents = useMemo(() => ({
    weatherAgent:    agentData.weatherAgent,
    trafficAgent:    agentData.trafficAgent,
    navigationAgent: agentData.navigationAgent,
    weatherLoading,
    flightLoading,
    agentLoading,
    agentError,
  }), [agentData, weatherLoading, flightLoading, agentLoading, agentError]);

  const events = useMemo(
    () => buildEvents(
      flights.length, weatherSummary, agentData,
      { flightLoaded: flights.length > 0, flightError, weatherLoaded: !weatherLoading, weatherError },
      swarmMode, swarmResults
    ),
    [flights.length, flightError, weatherLoading, weatherError, weatherSummary, agentData, swarmMode, swarmResults]
  );

  // Collect all swarm rerouteData objects for multi-route map rendering
  const swarmRerouteDataList = useMemo(
    () => swarmResults.filter(r => r.rerouteData && (r.status === "active" || r.status === "approved")).map(r => r.rerouteData),
    [swarmResults]
  );

  const isStormLoading = swarmMode
    ? swarmResults.some(r => r.status === "loading")
    : rerouteStatus === "loading";

  return (
    <div className="dashboard-shell">
      {/* Toast */}
      {toast && (
        <div className={`toast-notification ${toast.type === "warn" ? "toast-notification--warn" : ""}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Swarm mode active banner */}
      {swarmMode && (
        <div className="swarm-active-banner">
          ⚡ SWARM MODE — {swarmResults.length > 0 ? `${swarmResults.length} flights affected` : "5 flights armed"} · Click Inject Storm to trigger fleet-wide rerouting
        </div>
      )}

      <Header
        utcTime={utcTime}
        systemStatus={flightError || weatherError || agentError ? "Degraded" : "Operational"}
        swarmMode={swarmMode}
        onToggleSwarm={handleToggleSwarm}
      />

      <main
        className="dashboard-layout"
        style={{
          gridTemplateColumns: `${leftWidth}px 8px 1fr 8px ${rightWidth}px`,
          userSelect: (isResizingLeft || isResizingRight) ? "none" : "auto",
        }}
      >
        <FlightInfo
          flight={selectedFlight}
          loading={flightLoading}
          error={flightError}
          flights={displayFlights}
          onSelectFlight={handleSelectFlight}
          weatherThreats={agentData.weatherThreats || []}
          navigationDecisions={agentData.navigationDecisions || []}
          swarmMode={swarmMode}
          hoveredFlightId={hoveredFlightId}
          onHoverFlight={setHoveredFlightId}
          swarmSelectedFlightIds={swarmSelectedFlightIds}
          onToggleSwarmFlight={handleToggleSwarmFlight}
        />

        <div className={`resizer ${isResizingLeft ? "resizer--active" : ""}`} onMouseDown={handleMouseDownLeft} />

        <FlightMap
          flights={displayFlights}
          selectedFlightId={selectedFlightId}
          selectedFlight={selectedFlight}
          onSelectFlight={handleSelectFlight}
          weatherThreats={weatherThreats}
          trafficZones={agentData.trafficZones || []}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          rerouteData={swarmMode ? null : rerouteData}
          rerouteStatus={swarmMode ? "idle" : rerouteStatus}
          agentLog={agentLog}
          showOriginal={showOriginal}
          onToggleOriginal={setShowOriginal}
          onInjectStorm={handleInjectStorm}
          onApproveReroute={handleApproveReroute}
          onRejectReroute={rejectReroute}
          swarmMode={swarmMode}
          swarmRerouteDataList={swarmRerouteDataList}
          isStormLoading={isStormLoading}
          hoveredFlightId={hoveredFlightId}
          onHoverFlight={setHoveredFlightId}
          focusMode={focusMode}
          swarmSelectedFlightIds={swarmSelectedFlightIds}
          customStormCell={customStormCell}
          onCustomStormPlaced={handleCustomStormPlaced}
          onClearStorm={handleClearStorm}
        />

        <div className={`resizer ${isResizingRight ? "resizer--active" : ""}`} onMouseDown={handleMouseDownRight} />

        <section className="panel right-sidebar-panel" style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent", border: "none" }}>
          {/* Tab Selector */}
          <div className="right-panel-tabs" style={{ display: "flex", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--line)", borderRadius: "12px 12px 0 0" }}>
            <button
              className={`panel-tab-btn ${rightPanelTab === "summary" ? "panel-tab-btn--active" : ""}`}
              onClick={() => setRightPanelTab("summary")}
              style={{
                flex: 1,
                padding: "12px",
                background: "none",
                border: "none",
                color: rightPanelTab === "summary" ? "var(--cyan)" : "var(--muted)",
                fontWeight: "700",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                borderBottom: rightPanelTab === "summary" ? "2px solid var(--cyan)" : "none",
                transition: "all 0.2s",
                outline: "none"
              }}
            >
              {swarmMode ? "Fleet Summary" : "Telemetry Stats"}
            </button>
            <button
              className={`panel-tab-btn ${rightPanelTab === "console" ? "panel-tab-btn--active" : ""}`}
              onClick={() => setRightPanelTab("console")}
              style={{
                flex: 1,
                padding: "12px",
                background: "none",
                border: "none",
                color: rightPanelTab === "console" ? "var(--cyan)" : "var(--muted)",
                fontWeight: "700",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                borderBottom: rightPanelTab === "console" ? "2px solid var(--cyan)" : "none",
                transition: "all 0.2s",
                outline: "none"
              }}
            >
              💬 Agent Console
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {rightPanelTab === "summary" ? (
              swarmMode ? (
                <SwarmImpactPanel
                  swarmResults={swarmResults}
                  isSwarmLoading={isStormLoading}
                  onApproveAll={handleApproveAll}
                  onRejectAll={handleRejectAll}
                  hoveredFlightId={hoveredFlightId}
                  selectedFlightId={selectedFlightId}
                  onHoverFlight={setHoveredFlightId}
                  onSelectFlight={handleSelectFlight}
                  focusMode={focusMode}
                  onToggleFocus={setFocusMode}
                  onApproveFlight={handleApproveFlight}
                  onRejectFlight={handleRejectFlight}
                />
              ) : (
                <AgentPanel agentData={agents} />
              )
            ) : (
              <AgentConsole
                displayFlights={displayFlights}
                swarmSelectedFlightIds={swarmSelectedFlightIds}
                onToggleSwarmFlight={handleToggleSwarmFlight}
                onInjectStormForFlight={(flight) => {
                  if (swarmMode) {
                    handleSwarmInject();
                  } else {
                    injectStorm(flight, customStormCell);
                  }
                }}
                swarmMode={swarmMode}
                onSelectFlight={handleSelectFlight}
                customStormCell={customStormCell}
                onCustomStormPlaced={handleCustomStormPlaced}
                onClearStorm={handleClearStorm}
                rerouteData={rerouteData}
                rerouteStatus={rerouteStatus}
                swarmResults={swarmResults}
              />
            )}
          </div>
        </section>
      </main>

      <EventFeed events={events} />
    </div>
  );
}

export default Dashboard;
