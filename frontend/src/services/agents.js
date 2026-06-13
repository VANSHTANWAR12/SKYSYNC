import { fetchJson } from "./api";

export async function fetchAgentStatus(signal) {
  return fetchJson("/api/agents", { signal });
}
