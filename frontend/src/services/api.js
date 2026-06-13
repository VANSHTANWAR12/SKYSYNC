const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function fetchJson(path, options = {}) {
  const response = await fetch(apiUrl(path), options);

  if (!response.ok) {
    throw new Error(`${path} request failed with status ${response.status}`);
  }

  return response.json();
}
