from __future__ import annotations
import os
from pathlib import Path
from typing import Any
from concurrent.futures import ThreadPoolExecutor

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


# Simple cache for weather observations: (lat_rounded, lon_rounded) -> (weather_data, timestamp)
_weather_cache: dict[tuple[float, float], tuple[dict[str, Any], float]] = {}
CACHE_TTL = 300.0  # 5 minutes in seconds
MAX_API_REQUESTS_PER_CALL = 3  # Max real API requests to make per call to prevent rate limiting


def _generate_simulated_weather(latitude: float, longitude: float) -> dict[str, Any]:
    # Seed based on coordinate and 5-minute bucket to remain stable and deterministic
    import time
    import random
    seed_val = int(latitude * 1000 + longitude * 100000) + int(time.time() / 300)
    rng = random.Random(seed_val)
    
    # 85% clear/low risk, 10% high risk (rain/wind), 5% critical (storm)
    roll = rng.random()
    if roll < 0.85:
        # Clear
        weather_code = rng.choice([0, 1, 2, 3]) # Clear sky, mainly clear, partly cloudy, overcast
        wind_speed = rng.uniform(5.0, 25.0)
        precipitation = 0.0
    elif roll < 0.95:
        # High threat (Heavy rain / strong wind / low visibility)
        weather_code = rng.choice(list(RAIN_CODES) + list(LOW_VISIBILITY_CODES))
        wind_speed = rng.uniform(25.0, 55.0)
        precipitation = rng.uniform(1.0, 5.0)
    else:
        # Critical threat (Storm / dangerous wind)
        weather_code = rng.choice(list(STORM_CODES))
        wind_speed = rng.uniform(55.0, 85.0)
        precipitation = rng.uniform(5.0, 15.0)
        
    risk_level = _risk_level_from_weather(weather_code, wind_speed, precipitation)
    
    current = {
        "wind_speed_10m": wind_speed,
        "temperature_2m": rng.uniform(15.0, 35.0),
        "precipitation": precipitation,
        "weather_code": weather_code
    }
    
    return {
        "latitude": latitude,
        "longitude": longitude,
        "windSpeed": wind_speed,
        "temperature": current["temperature_2m"],
        "precipitation": precipitation,
        "weatherCode": weather_code,
        "riskLevel": risk_level,
        "riskScore": _threat_score(risk_level, wind_speed, precipitation, weather_code),
        "weatherThreat": _threat_label(weather_code, wind_speed, precipitation),
        "current": current,
    }


def fetch_weather_for_flights(flights: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    import time
    now = time.time()
    observations: list[dict[str, Any]] = []
    
    # 1. Group by broader sectors (0.5 degree precision ~50km)
    location_map = {}
    for flight in flights:
        lat = flight.get("latitude")
        lon = flight.get("longitude")
        if lat is not None and lon is not None:
            # Multi-point clustering (0.5 degree precision)
            key = (round(float(lat) * 2) / 2, round(float(lon) * 2) / 2)
            if key not in location_map:
                location_map[key] = []
            location_map[key].append(flight)

    if not location_map:
        return [], _meta("empty", "No flights with coordinates were available for weather lookup")

    # 2. Check cache and identify coordinates that need real fetch
    weather_cache_resolved = {}
    uncached_keys = []
    
    for key in location_map.keys():
        if key in _weather_cache:
            weather_data, ts = _weather_cache[key]
            if now - ts < CACHE_TTL:
                weather_cache_resolved[key] = weather_data
                continue
        uncached_keys.append(key)

    # 3. For uncached keys, limit the number of active API requests to avoid rate limits
    api_fetch_keys = uncached_keys[:MAX_API_REQUESTS_PER_CALL]
    simulated_keys = uncached_keys[MAX_API_REQUESTS_PER_CALL:]

    # Parallel fetch for the limited API keys
    api_results = []
    if api_fetch_keys:
        def _fetch_and_map(geo_key):
            lat, lon = geo_key
            weather, meta = fetch_weather_at_coordinate(lat, lon)
            return geo_key, weather, meta
            
        with ThreadPoolExecutor(max_workers=min(len(api_fetch_keys), 5)) as executor:
            api_results = list(executor.map(_fetch_and_map, api_fetch_keys))

    # Process API results, cache them
    api_success_count = 0
    for key, weather, meta in api_results:
        if weather:
            _weather_cache[key] = (weather, now)
            weather_cache_resolved[key] = weather
            api_success_count += 1
        else:
            sim_weather = _generate_simulated_weather(key[0], key[1])
            _weather_cache[key] = (sim_weather, now)
            weather_cache_resolved[key] = sim_weather

    # Process simulated keys
    for key in simulated_keys:
        sim_weather = _generate_simulated_weather(key[0], key[1])
        _weather_cache[key] = (sim_weather, now)
        weather_cache_resolved[key] = sim_weather

    # 4. Redistribute intelligence
    for key, weather in weather_cache_resolved.items():
        associated_flights = location_map[key]
        for flight in associated_flights:
            observations.append({
                "flightNumber": flight.get("flightNumber"),
                "airline": flight.get("airline"),
                "latitude": flight.get("latitude"),
                "longitude": flight.get("longitude"), 
                "windSpeed": weather["windSpeed"],
                "temperature": weather["temperature"],
                "precipitation": weather["precipitation"],
                "weatherCode": weather["weatherCode"],
                "riskLevel": weather["riskLevel"],
                "riskScore": weather["riskScore"],
                "weatherThreat": weather["weatherThreat"],
                "recommendation": (
                    "Reroute Recommended" if weather["riskLevel"] == "CRITICAL"
                    else "Monitor Closely" if weather["riskLevel"] == "HIGH"
                    else "Continue Monitoring"
                ),
            })

    status_msg = f"Weather synchronized. Cached: {len(location_map) - len(uncached_keys)}. API fetched: {api_success_count} (out of {len(api_fetch_keys)}). Simulated: {len(simulated_keys) + (len(api_fetch_keys) - api_success_count)}."
    
    return observations, _meta("ready", status_msg)


def build_weather_summary(observations: list[dict[str, Any]]) -> dict[str, int]:
    threats = [observation for observation in observations if observation["riskLevel"] != "LOW"]

    return {
        "maxRisk": max((int(observation.get("riskScore") or 0) for observation in observations), default=0),
        "totalThreats": len(threats),
        "highThreats": sum(1 for observation in observations if observation["riskLevel"] == "HIGH"),
        "criticalThreats": sum(1 for observation in observations if observation["riskLevel"] == "CRITICAL"),
    }
