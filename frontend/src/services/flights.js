import { fetchJson } from "./api";

function normalizeFlight(item, index) {
  if (!item) {
    return null;
  }

  const flightNumber = item.flightNumber || item.flight_number || item.callsign || item.number || item.flight || `FL-${index + 1}`;

  return {
    id: item.id || flightNumber,
    flightNumber,
    airline: item.airline || item.carrier || item.operator || "Unknown Airline",
    origin: item.origin || item.from || item.departure || "Unknown",
    destination: item.destination || item.to || item.arrival || "Unknown",
    status: item.status || item.state || item.phase || "Unknown",
    latitude:
      item.latitude != null
        ? Number(item.latitude)
        : item.lat != null
          ? Number(item.lat)
          : item.currentLatitude != null
            ? Number(item.currentLatitude)
            : null,
    longitude:
      item.longitude != null
        ? Number(item.longitude)
        : item.lon != null
          ? Number(item.lon)
          : item.currentLongitude != null
            ? Number(item.currentLongitude)
            : null,
    altitude: item.altitude ?? item.flightLevel ?? "N/A",
    speed: item.speed ?? item.groundSpeed ?? item.velocity ?? "N/A",
    fuelRemaining:
      item.fuelRemaining || item.fuel_remaining || item.fuel || item.fuelPercent || "N/A",
    heading: Number(item.heading ?? item.track ?? item.trueTrack ?? 0),
  };
}

export async function fetchLiveFlights(signal) {
  const payload = await fetchJson("/api/flights", { signal });
  const rawFlights = Array.isArray(payload) ? payload : payload?.items || payload?.data || [];

  return rawFlights.map(normalizeFlight).filter(Boolean);
}
