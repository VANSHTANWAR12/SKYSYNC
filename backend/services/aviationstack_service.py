import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

AVIATIONSTACK_KEY = os.getenv("AVIATIONSTACK_KEY")
AVIATIONSTACK_URL = os.getenv("AVIATIONSTACK_URL", "https://api.aviationstack.com/v1/flights")
AVIATIONSTACK_TIMEOUT = int(os.getenv("AVIATIONSTACK_TIMEOUT", "20"))

INDIA_KEYWORDS = {
    "india",
    "delhi",
    "mumbai",
    "kolkata",
    "chennai",
    "bangalore",
    "bengaluru",
    "hyderabad",
    "pune",
    "nagpur",
    "ahmedabad",
    "jaipur",
    "goa",
}


def aviationstack_ready() -> bool:
    return bool(AVIATIONSTACK_KEY)


def _meta(status: str, message: str | None = None) -> dict[str, Any]:
    return {"provider": "aviationstack", "status": status, "message": message}


def _safe_get(obj: dict[str, Any] | None, *keys: str, default: Any = None) -> Any:
    current: Any = obj or {}
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current


def _contains_india(*values: Any) -> bool:
    text = " ".join(str(value or "").lower() for value in values)
    return any(keyword in text for keyword in INDIA_KEYWORDS)


def _normalize_position(*pairs: tuple[Any, Any]) -> tuple[float | None, float | None]:
    for latitude, longitude in pairs:
        if latitude is None or longitude is None:
            continue
        try:
            return float(latitude), float(longitude)
        except (TypeError, ValueError):
            continue
    return None, None


def _fetch_flights_payload(params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    try:
        response = requests.get(AVIATIONSTACK_URL, params=params, timeout=AVIATIONSTACK_TIMEOUT)
    except requests.RequestException as exc:
        return [], _meta("unavailable", f"AviationStack request failed: {exc}")

    if response.status_code == 429:
        return [], _meta("rate_limited", "AviationStack rate limit reached")

    if response.status_code in {401, 403}:
        return [], _meta("unauthorized", "AviationStack rejected the configured API key")

    try:
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        return [], _meta("unavailable", f"AviationStack response could not be processed: {exc}")

    api_error = payload.get("error")
    if api_error:
        message = api_error.get("message") if isinstance(api_error, dict) else str(api_error)
        return [], _meta("error", message)

    data = payload.get("data", []) or []
    if not isinstance(data, list):
        return [], _meta("empty", "AviationStack returned an unexpected payload")

    return data, _meta("ready" if data else "empty", None if data else "AviationStack returned no flights")


def _normalize_flights(flights: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    fallback: list[dict[str, Any]] = []

    for flight in flights:
        departure = flight.get("departure") or {}
        arrival = flight.get("arrival") or {}
        live = flight.get("live") or {}
        flight_meta = flight.get("flight") or {}
        airline = flight.get("airline") or {}

        latitude, longitude = _normalize_position(
            (live.get("latitude"), live.get("longitude")),
            (departure.get("latitude"), departure.get("longitude")),
            (arrival.get("latitude"), arrival.get("longitude")),
        )

        item = {
            "flightNumber": flight_meta.get("iata")
            or flight_meta.get("icao")
            or flight.get("flight_number")
            or "Unknown",
            "airline": airline.get("name") or "Unknown Airline",
            "origin": departure.get("airport") or departure.get("city") or "Unknown",
            "destination": arrival.get("airport") or arrival.get("city") or "Unknown",
            "status": flight.get("flight_status") or "active",
            "latitude": latitude,
            "longitude": longitude,
            "altitude": live.get("altitude") or _safe_get(live, "altitude") or 0,
            "speed": live.get("speed_horizontal") or live.get("speed") or 0,
            "departureCountry": departure.get("country"),
            "arrivalCountry": arrival.get("country"),
        }

        fallback.append(item)

        if _contains_india(
            departure.get("country"),
            departure.get("city"),
            departure.get("airport"),
            arrival.get("country"),
            arrival.get("city"),
            arrival.get("airport"),
        ):
            normalized.append(item)

    return normalized or fallback


def fetch_active_flights(limit: int = 20) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not AVIATIONSTACK_KEY:
        return [], _meta("missing_key", "AVIATIONSTACK_KEY is not configured")

    flights, meta = _fetch_flights_payload(
        {
            "access_key": AVIATIONSTACK_KEY,
            "flight_status": "active",
            "limit": limit,
        }
    )

    if not flights and meta["status"] == "empty":
        flights, meta = _fetch_flights_payload(
            {
                "access_key": AVIATIONSTACK_KEY,
                "limit": limit,
            }
        )

    items = _normalize_flights(flights)
    if not items and meta["status"] == "ready":
        meta = _meta("empty", "No usable flights were present in the AviationStack payload")

    return items, meta
