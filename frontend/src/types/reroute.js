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
 * @property {number} timeSavingsMin
 * @property {number} safetyScore
 * @property {number} originalFuelKg
 * @property {number} alternateFuelKg
 * @property {number} originalTimeMin
 * @property {number} alternateTimeMin
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
