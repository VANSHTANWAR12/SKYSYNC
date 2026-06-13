import { apiUrl } from "./api";

const AUTH_TOKEN_KEY = "skysync_auth_token";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function fetchJsonWithAuth(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `${path} request failed with status ${response.status}`);
  }

  return response.json();
}

export async function loginUser(email, password) {
  const response = await fetchJsonWithAuth("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(response.token);
  return response.user;
}

export async function registerUser(email, password) {
  const response = await fetchJsonWithAuth("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(response.token);
  return response.user;
}

export async function fetchCurrentUser() {
  return fetchJsonWithAuth("/api/auth/me", {
    method: "GET",
  });
}

export async function logoutUser() {
  await fetchJsonWithAuth("/api/auth/logout", {
    method: "POST",
  });
  removeAuthToken();
}
