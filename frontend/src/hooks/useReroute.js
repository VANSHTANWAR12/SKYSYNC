/**
 * SkySync — useReroute hook
 * Manages inject-storm lifecycle: API call, reroute state, agent log, approvals.
 *
 * @returns {{
 *   rerouteData: import('../types/reroute').RerouteData|null,
 *   rerouteStatus: import('../types/reroute').RerouteStatus,
 *   agentLog: import('../types/reroute').AgentLogEntry[],
 *   showOriginal: boolean,
 *   injectStorm: (flight: object, airportCoords: Function) => void,
 *   approveReroute: () => void,
 *   rejectReroute: () => void,
 *   setShowOriginal: (v: boolean) => void,
 * }}
 */
import { useState, useCallback, useRef } from "react";
import { injectStorm as apiInjectStorm } from "../services/reroute";
// Airport coordinate resolver from FlightMap — re-exported here to avoid duplication
import { resolveAirportCoords } from "../utils/airportCoords";

export function useReroute() {
  /** @type {[import('../types/reroute').RerouteData|null, Function]} */
  const [rerouteData, setRerouteData] = useState(null);

  /** @type {[import('../types/reroute').RerouteStatus, Function]} */
  const [rerouteStatus, setRerouteStatus] = useState("idle");

  /** @type {[import('../types/reroute').AgentLogEntry[], Function]} */
  const [agentLog, setAgentLog] = useState([]);

  const [showOriginal, setShowOriginal] = useState(true);

  const controllerRef = useRef(null);

  /**
   * Inject a storm event for the given flight.
   * @param {object} flight — normalized flight object from flights state
   */
  const injectStorm = useCallback(async (flight, customStorm = null) => {
    if (!flight) return;

    // Cancel any in-flight request
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    setRerouteStatus("loading");
    setAgentLog([]);
    setRerouteData(null);
    setShowOriginal(true);

    // Resolve real lat/lng for origin + destination from airport display names
    // Use plane's current coordinates so reroute calculations begin from its current position
    const originCoords      = (flight.latitude != null && flight.longitude != null)
      ? [flight.latitude, flight.longitude]
      : (resolveAirportCoords(flight.origin) || [26.1445, 91.7362]);
    const destinationCoords = resolveAirportCoords(flight.destination)  || [13.0827, 80.2707];

    try {
      const data = await apiInjectStorm(
        {
          flightId:    flight.id,
          flightNumber: flight.flightNumber,
          airline:     flight.airline,
          origin:      flight.origin,
          destination: flight.destination,
          originCoords,
          destinationCoords,
          customStorm,
        },
        controllerRef.current.signal
      );

      setRerouteData(data);
      setAgentLog(data.agentLog || []);
      setRerouteStatus("active");
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Reroute injection failed:", err);
      // Surface as rejected so UI can display an error state
      setRerouteStatus("rejected");
      setAgentLog([{
        agent: "System",
        type: "INFO",
        message: `Failed to compute reroute: ${err.message}`,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, []);

  const approveReroute = useCallback(() => {
    setRerouteStatus("approved");
    setAgentLog(prev => [...prev, {
      agent: "Captain",
      type: "DECISION",
      message: "Reroute APPROVED by captain. Alternate route is now active flight plan.",
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  const rejectReroute = useCallback(() => {
    setRerouteStatus("rejected");
    setRerouteData(null);
    setAgentLog(prev => [...prev, {
      agent: "Captain",
      type: "DECISION",
      message: "Reroute REJECTED. Maintaining original flight plan.",
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  return {
    rerouteData,
    rerouteStatus,
    agentLog,
    showOriginal,
    setShowOriginal,
    injectStorm,
    approveReroute,
    rejectReroute,
  };
}
