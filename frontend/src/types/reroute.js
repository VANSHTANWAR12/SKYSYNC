/**
 * SkySync — Reroute Types (JSDoc)
 * Mirrors the backend RerouteData response shape.
 */

/**
 * @typedef {Object} RoutePoint
 * @property {number} lat
 * @property {number} lng
 * @property {number} [altitude]
 */

/**
 * @typedef {Object} FlightRoute
 * @property {string} id
 * @property {RoutePoint[]} points
 * @property {string} color       — hex colour for the polyline
 * @property {number} opacity     — 0–1
 * @property {number} lineWidth   — pixels
 * @property {string} label
 * @property {number} totalDistanceKm
 * @property {number} estimatedFuelKg
 * @property {number} estimatedTimeMin
 */

/**
 * @typedef {'low'|'medium'|'high'} ThreatSeverity
 *
 * @typedef {Object} ThreatZone
 * @property {[number, number]} center   — [lat, lng]
 * @property {number} radiusKm
 * @property {ThreatSeverity} severity
 * @property {string} [label]
 * @property {number} [windSpeed]
 * @property {number} [precipitation]
 */

/**
 * @typedef {Object} RouteMetrics
 * @property {number} fuelSavingsPercent
 * @property {number} timeDeltaMin        — alternate minus original (negative = alternate is faster)
 * @property {number} safetyScore
 * @property {number} originalFuelKg      — includes storm holding/manoeuvre fuel penalty
 * @property {number} alternateFuelKg
 * @property {number} originalTimeMin     — includes storm holding time penalty
 * @property {number} alternateTimeMin
 * @property {number} holdingTimePenaltyMin — storm delay applied to original route (scales with wind speed)
 * @property {number} holdingFuelPenaltyKg  — storm fuel burn applied to original route (scales with wind speed)
 */

/**
 * @typedef {'SCAN'|'ANALYSIS'|'COMPUTE'|'DECISION'|'METRICS'|'INFO'} AgentLogType
 *
 * @typedef {Object} AgentLogEntry
 * @property {string} agent       — "Weather Agent" | "Traffic Agent" | "Navigation Agent"
 * @property {AgentLogType} type
 * @property {string} message
 * @property {string} timestamp   — ISO-8601
 */

/**
 * @typedef {Object} RerouteData
 * @property {string} flightId
 * @property {string} flightNumber
 * @property {string} airline
 * @property {string} generatedAt
 * @property {FlightRoute} originalRoute
 * @property {FlightRoute} alternateRoute
 * @property {ThreatZone[]} threatZones
 * @property {RouteMetrics} metrics
 * @property {AgentLogEntry[]} agentLog
 */

/**
 * @typedef {'idle'|'loading'|'active'|'approved'|'rejected'} RerouteStatus
 */
