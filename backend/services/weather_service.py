import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

OPEN_METEO_URL = os.getenv("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast")
OPEN_METEO_TIMEOUT = int(os.getenv("OPEN_METEO_TIMEOUT", "20"))

STORM_CODES = {95, 96, 99}
RAIN_CODES = {51, 53, 55, 61, 63, 65, 80, 81, 82, 66, 67}
LOW_VISIBILITY_CODES = {45, 48}


def weather_ready() -> bool:
    return bool(OPEN_METEO_URL)


def _meta(status: str, message: str | None = None) -> dict[str, Any]:
    return {"provider": "open-meteo", "status": status, "message": message}


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _risk_level_from_weather(weather_code: int, wind_speed: float, precipitation: float) -> str:
    if weather_code in STORM_CODES or wind_speed > 70:
        return "CRITICAL"
    if wind_speed > 50:
        return "HIGH"
    if weather_code in RAIN_CODES or precipitation >= 2 or weather_code in LOW_VISIBILITY_CODES:
        return "HIGH"
    return "LOW"


def _threat_label(weather_code: int, wind_speed: float, precipitation: float) -> str:
    if weather_code in STORM_CODES:
        return "Storm"
    if wind_speed > 70:
        return "Dangerous Wind"
    if wind_speed > 50:
        return "Strong Wind"
    if precipitation >= 2 or weather_code in RAIN_CODES:
        return "Heavy Rain"
    if weather_code in LOW_VISIBILITY_CODES:
        return "Low Visibility"
    return "Clear"


def _threat_score(risk_level: str, wind_speed: float, precipitation: float, weather_code: int) -> int:
    base_score = {"LOW": 10, "HIGH": 60, "CRITICAL": 90}.get(risk_level, 0)
    wind_score = min(30, int(wind_speed / 3))
    rain_score = min(20, int(precipitation * 4))
    storm_score = 20 if weather_code in STORM_CODES else 0
    return min(100, base_score + wind_score + rain_score + storm_score)


def fetch_weather_at_coordinate(latitude: float, longitude: float) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "wind_speed_10m,temperature_2m,precipitation,weather_code",
        "timezone": "UTC",
        "forecast_days": 1,
    }

    try:
        response = requests.get(OPEN_METEO_URL, params=params, timeout=OPEN_METEO_TIMEOUT)
    except requests.RequestException as exc:
        return None, _meta("unavailable", f"Open-Meteo request failed: {exc}")

    if response.status_code == 429:
        return None, _meta("rate_limited", "Open-Meteo rate limit reached")

    try:
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        return None, _meta("unavailable", f"Open-Meteo response could not be processed: {exc}")

    current = payload.get("current", {}) or {}
    if not current:
        return None, _meta("empty", "Open-Meteo returned no current weather")

    wind_speed = _to_float(current.get("wind_speed_10m"))
    precipitation = _to_float(current.get("precipitation"))
    weather_code = int(_to_float(current.get("weather_code"), 0))
    risk_level = _risk_level_from_weather(weather_code, wind_speed, precipitation)

    return {
        "latitude": latitude,
        "longitude": longitude,
        "windSpeed": wind_speed,
        "temperature": _to_float(current.get("temperature_2m")),
        "precipitation": precipitation,
        "weatherCode": weather_code,
        "riskLevel": risk_level,
        "riskScore": _threat_score(risk_level, wind_speed, precipitation, weather_code),
        "weatherThreat": _threat_label(weather_code, wind_speed, precipitation),
        "current": current,
    }, _meta("ready")


def fetch_weather_for_flights(flights: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    last_meta = _meta("empty", "No flights with coordinates were available for weather lookup")

    for flight in flights[:5]:  # Limit to 5 flights to prevent slow sequential API calls
        latitude = flight.get("latitude")
        longitude = flight.get("longitude")

        if latitude is None or longitude is None:
            continue

        weather, current_meta = fetch_weather_at_coordinate(float(latitude), float(longitude))
        last_meta = current_meta
        if not weather:
            continue

        observations.append(
            {
                "flightNumber": flight.get("flightNumber"),
                "airline": flight.get("airline"),
                "latitude": weather["latitude"],
                "longitude": weather["longitude"],
                "windSpeed": weather["windSpeed"],
                "temperature": weather["temperature"],
                "precipitation": weather["precipitation"],
                "weatherCode": weather["weatherCode"],
                "riskLevel": weather["riskLevel"],
                "riskScore": weather["riskScore"],
                "weatherThreat": weather["weatherThreat"],
                "recommendation": (
                    "Reroute Recommended"
                    if weather["riskLevel"] == "CRITICAL"
                    else "Monitor Closely"
                    if weather["riskLevel"] == "HIGH"
                    else "Continue Monitoring"
                ),
            }
        )

    if observations:
        return observations, _meta("ready")

    return observations, last_meta


def build_weather_summary(observations: list[dict[str, Any]]) -> dict[str, int]:
    threats = [observation for observation in observations if observation["riskLevel"] != "LOW"]

    return {
        "maxRisk": max((int(observation.get("riskScore") or 0) for observation in observations), default=0),
        "totalThreats": len(threats),
        "highThreats": sum(1 for observation in observations if observation["riskLevel"] == "HIGH"),
        "criticalThreats": sum(1 for observation in observations if observation["riskLevel"] == "CRITICAL"),
    }
