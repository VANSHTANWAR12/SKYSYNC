/**
 * SkySync — Reroute API service
 * Calls POST /api/reroute with flight context.
 */
import { fetchJson } from "./api";

/**
 * Trigger a storm injection for a selected flight.
 * @param {object} flightContext
 * @param {string} flightContext.flightId
 * @param {string} flightContext.flightNumber
 * @param {string} flightContext.airline
 * @param {string} flightContext.origin       — display name, e.g. "GUWAHATI (GAU)"
 * @param {string} flightContext.destination  — display name, e.g. "CHENNAI (MAA)"
 * @param {[number,number]} flightContext.originCoords      — [lat, lng]
 * @param {[number,number]} flightContext.destinationCoords — [lat, lng]
 * @param {AbortSignal} [signal]
 * @returns {Promise<import('../types/reroute').RerouteData>}
 */
export async function injectStorm(flightContext, signal) {
  return fetchJson("/api/reroute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      flightId:    flightContext.flightId,
      flightNumber: flightContext.flightNumber,
      airline:     flightContext.airline,
      origin:      flightContext.originCoords,
      destination: flightContext.destinationCoords,
      originName:  flightContext.origin,
      destinationName: flightContext.destination,
      customStorm:  flightContext.customStorm,
    }),
    signal,
  });
}
