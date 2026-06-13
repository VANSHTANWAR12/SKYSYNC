import { fetchJson } from "./api";

export async function fetchWeatherThreats(signal) {
  const payload = await fetchJson("/api/weather", { signal });

  return {
    threats: payload?.threats || payload?.items || [],
    observations: payload?.items || payload?.threats || [],
    summary: payload?.summary || { maxRisk: 0, totalThreats: 0, highThreats: 0, criticalThreats: 0 },
  };
}
