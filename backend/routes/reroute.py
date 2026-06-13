"""
SkySync — Reroute Agent Endpoint
POST /api/reroute  { "flightId": "...", "origin": [...], "destination": [...] }
Returns full RerouteData including original route, alternate route,
threat zones, agent reasoning log, and comparison metrics.
"""
from __future__ import annotations
import math
import time
import os
import json
import requests
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body

router = APIRouter()



# ── Helpers ────────────────────────────────────────────────────────────────────

def _interpolate_great_circle(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
    steps: int = 12
) -> list[dict[str, float]]:
    """Return `steps` evenly-spaced waypoints along a great-circle arc."""
    points = []
    for i in range(steps + 1):
        t = i / steps
        lat = lat1 + t * (lat2 - lat1)
        lon = lon1 + t * (lon2 - lon1)
        # Slight altitude arc — cruise at FL360 in the middle
        alt = 28000 + math.sin(t * math.pi) * 8000
        points.append({"lat": round(lat, 4), "lng": round(lon, 4), "altitude": round(alt)})
    return points


def _alternate_route(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
    storm_center: tuple[float, float],
    steps: int = 14
) -> list[dict[str, float]]:
    """
    Route that deviates east/west around a storm cell.
    The detour offset peaks at the storm's along-track position.
    """
    sc_lat, sc_lon = storm_center
    # Fractional position of storm along the route (0–1)
    total_lat = lat2 - lat1
    t_storm = (sc_lat - lat1) / total_lat if total_lat != 0 else 0.5
    t_storm = max(0.1, min(0.9, t_storm))

    # Perpendicular offset direction — go east if storm is west of mid-lon
    mid_lon = (lon1 + lon2) / 2
    offset_direction = 1 if sc_lon < mid_lon else -1
    offset_deg = 3.5  # ~350 km lateral deviation

    points = []
    for i in range(steps + 1):
        t = i / steps
        base_lat = lat1 + t * (lat2 - lat1)
        base_lon = lon1 + t * (lon2 - lon1)
        # Bell-curve detour that peaks at t_storm
        detour = offset_direction * offset_deg * math.exp(
            -((t - t_storm) ** 2) / (2 * 0.04)
        )
        alt = 28000 + math.sin(t * math.pi) * 9000  # slightly higher alt on alternate
        points.append({
            "lat": round(base_lat, 4),
            "lng": round(base_lon + detour, 4),
            "altitude": round(alt)
        })
    return points


def _haversine_km(p1: dict, p2: dict) -> float:
    R = 6371.0
    dlat = math.radians(p2["lat"] - p1["lat"])
    dlon = math.radians(p2["lng"] - p1["lng"])
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(p1["lat"]))
         * math.cos(math.radians(p2["lat"]))
         * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def _route_distance_km(points: list[dict]) -> float:
    total = 0.0
    for i in range(1, len(points)):
        total += _haversine_km(points[i - 1], points[i])
    return round(total, 1)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_copilot_briefing(
    flight_num: str,
    airline: str,
    orig_city: str,
    dest_city: str,
    storm_wind: float,
    storm_precip: float,
    clearance_km: float,
    fuel_delta: float,
    time_delta: float,
    safety_score: int
) -> dict[str, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    prompt = f"""
    You are the AI Dispatch Copilot for SkySync.
    Generate a concise natural language cockpit briefing and a formatted radio transmission ATC script for:
    - Flight: {flight_num} ({airline}) flying from {orig_city} to {dest_city}
    - Weather Alert: Severe storm cell with {storm_wind} km/h winds and {storm_precip} mm/h precipitation.
    - Solution: Detour around the storm clearing it by {clearance_km} km.
    - Impact: Fuel delta is {fuel_delta:+} kg, Flight time delta is {time_delta:+} min.
    - Safety Score: {safety_score}/100.
    
    Respond in JSON format with exactly two keys:
    "briefing": a brief, professional 2-3 sentence summary explaining the routing decision to the captain.
    "atc_script": the exact radio transmission phraseology (e.g. "Kolkata Control, [Callsign] requesting...") that the pilot should read to ATC.
    Do not wrap in markdown or backticks. Only return raw JSON.
    """
    
    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            resp = requests.post(url, json=payload, timeout=5)
            if resp.status_code == 200:
                result = resp.json()
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                data = json.loads(text)
                return {
                    "briefing": data.get("briefing", ""),
                    "atc_script": data.get("atc_script", "")
                }
        except Exception:
            pass
            
    # Fallback to local rule-based text generation (Symbolic AI)
    briefing = (
        f"Captain, we have computed a lateral deviation around the storm cell. The alternative route clears the core "
        f"by approximately {clearance_km} km. Airspace traffic is clear in this sector. Safety score is evaluated "
        f"at {safety_score}/100. The detour adds {fuel_delta:+.0f} kg of fuel but avoids hazardous weather turbulence."
    )
    atc_script = (
        f"Control, {airline.split()[0].upper()} {flight_num.replace('-', '')} requesting weather avoidance deviation. "
        f"Estimating back on track in {abs(time_delta) if time_delta != 0 else 10} minutes."
    )
    return {"briefing": briefing, "atc_script": atc_script}


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/reroute")
def inject_storm_reroute(
    body: dict = Body(...)
) -> dict[str, Any]:
    """
    Simulate a storm injection for a given flight and return both the
    original route and a computed alternate route with full agent reasoning.
    """
    flight_id   = body.get("flightId", "UNKNOWN")
    origin      = body.get("origin", [26.1445, 91.7362])    # Default: Guwahati
    destination = body.get("destination", [13.0827, 80.2707])  # Default: Chennai
    flight_num  = body.get("flightNumber", flight_id)
    airline     = body.get("airline", "Unknown Airline")

    o_lat, o_lon = float(origin[0]), float(origin[1])
    d_lat, d_lon = float(destination[0]), float(destination[1])

    custom_storm = body.get("customStorm")
    if custom_storm and isinstance(custom_storm, list) and len(custom_storm) == 2:
        storm_lat = round(float(custom_storm[0]), 4)
        storm_lon = round(float(custom_storm[1]), 4)
        storm_center = (storm_lat, storm_lon)
    else:
        # Storm is placed ~35% along the route, slightly east
        t_storm = 0.38
        storm_lat = round(o_lat + t_storm * (d_lat - o_lat), 4)
        storm_lon = round(o_lon + t_storm * (d_lon - o_lon) + 1.8, 4)
        storm_center = (storm_lat, storm_lon)

    # Build routes
    orig_points = _interpolate_great_circle(o_lat, o_lon, d_lat, d_lon, steps=12)
    alt_points  = _alternate_route(o_lat, o_lon, d_lat, d_lon, storm_center, steps=14)

    orig_dist_km = _route_distance_km(orig_points)
    alt_dist_km  = _route_distance_km(alt_points)

    # ── Dynamic storm severity ────────────────────────────────────────────────
    # Seed a deterministic-but-varied value from the flight ID so every flight
    # gets a different (but reproducible) storm.  We use a simple hash so there's
    # no import needed beyond the stdlib.
    _seed = sum(ord(c) for c in str(flight_id)) % 100   # 0-99

    # Wind speed: 55–105 km/h depending on flight
    storm_wind_speed    = 55 + (_seed % 51)
    # Precipitation: 8–28 mm/hr
    storm_precipitation = 8  + (_seed % 21)
    # Storm radius: 150–320 km
    storm_radius_km     = 150 + (_seed % 171)

    # Fuel estimate: ~3.5 kg/km at cruise (simplified)
    fuel_rate = 3.5
    base_orig_fuel = round(orig_dist_km * fuel_rate)
    alt_fuel  = round(alt_dist_km  * fuel_rate)

    # Time estimate: ~850 km/h cruise speed
    cruise_speed = 850.0
    base_orig_time = round(orig_dist_km / cruise_speed * 60)
    alt_time_min  = round(alt_dist_km / cruise_speed * 60)

    # Reality modeling: Staying on the original route means passing directly through
    # a convective storm, requiring holding patterns (delay + severe fuel consumption)
    # and lower, less efficient cruise altitudes (additional fuel burn).
    # Penalties scale with storm_wind_speed (range 55–105 km/h → penalty range below):
    #   holding_time_penalty : 15 min (light storm) → 35 min (severe storm)
    #   holding_fuel_penalty : 400 kg (light storm) → 900 kg (severe storm)
    wind_severity = max(0.0, min(1.0, (storm_wind_speed - 55) / 50))  # 0.0–1.0
    holding_time_penalty = round(15 + wind_severity * 20)   # 15–35 min
    holding_fuel_penalty = round(400 + wind_severity * 500)  # 400–900 kg

    orig_fuel = base_orig_fuel + holding_fuel_penalty
    orig_time_min = base_orig_time + holding_time_penalty

    # Alternate route completely bypasses the storm zone, avoiding holding/maneuver penalties.
    effective_alt_time = alt_time_min

    fuel_savings_pct = round((1 - alt_fuel / max(orig_fuel, 1)) * 100, 1)
    # time_delta_min: negative = alternate is faster (saves time), positive = alternate adds delay
    time_delta_min = effective_alt_time - orig_time_min

    # ── Safety score logic ────────────────────────────────────────────────────
    # Clearance: how far (km) the alternate route deviates at its peak from the
    # storm center — higher clearance relative to storm radius → higher safety.
    # offset_deg (3.5°) × cos(avg_lat) × 111 km/° ≈ lateral deviation in km
    avg_lat = (o_lat + d_lat) / 2
    lateral_dev_km = 3.5 * math.cos(math.radians(avg_lat)) * 111.0
    clearance_ratio = lateral_dev_km / max(storm_radius_km, 1)   # >1 = fully clear

    # Base score: clearance-driven (60–95 range)
    base_score = min(95, max(60, round(60 + clearance_ratio * 35)))

    # Penalty: heavy wind / precipitation reduces confidence
    wind_penalty  = max(0, (storm_wind_speed - 60) // 10)        # 0-4 pts
    rain_penalty  = max(0, (storm_precipitation - 10) // 5)      # 0-3 pts

    # Bonus: longer route gives more reroute options
    distance_bonus = min(5, round(orig_dist_km / 500))           # 0-5 pts

    safety_score = int(base_score - wind_penalty - rain_penalty + distance_bonus)
    safety_score = max(55, min(98, safety_score))   # clamp to [55, 98]

    # Clearance distance in km for the log message
    clearance_km = round(lateral_dev_km - storm_radius_km * 0.5)

    # Agent reasoning log — realistic step-by-step reasoning
    ts = _now_iso()
    agent_log = [
        {
            "agent": "Weather Agent",
            "type": "SCAN",
            "message": f"Storm cell detected at {storm_lat}°N, {storm_lon}°E — Classification: CRITICAL (WX Code 99).",
            "timestamp": ts,
        },
        {
            "agent": "Weather Agent",
            "type": "ANALYSIS",
            "message": f"Wind speed {storm_wind_speed} km/h, precipitation {storm_precipitation} mm/hr. Risk level: CRITICAL. Storm radius ~{storm_radius_km} km.",
            "timestamp": ts,
        },
        {
            "agent": "Traffic Agent",
            "type": "SCAN",
            "message": "Scanning alternate corridor for airspace congestion...",
            "timestamp": ts,
        },
        {
            "agent": "Traffic Agent",
            "type": "ANALYSIS",
            "message": "Alternate corridor (east deviation) is CLEAR — 3 aircraft in sector, congestion: LOW.",
            "timestamp": ts,
        },
        {
            "agent": "Navigation Agent",
            "type": "COMPUTE",
            "message": f"Computing alternate route for {flight_num} ({airline}). Original: {orig_dist_km} km. Alternate: {alt_dist_km} km.",
            "timestamp": ts,
        },
        {
            "agent": "Navigation Agent",
            "type": "DECISION",
            "message": f"REROUTE RECOMMENDED. Alternate clears storm by ~{clearance_km} km. Safety score: {safety_score}/100.",
            "timestamp": ts,
        },
        {
            "agent": "Navigation Agent",
            "type": "METRICS",
            "message": (
                f"Fuel: {orig_fuel} kg → {alt_fuel} kg ({'+' if alt_fuel > orig_fuel else ''}{alt_fuel - orig_fuel} kg). "
                f"ETA: {orig_time_min} min → {effective_alt_time} min "
                f"({'+' if time_delta_min > 0 else ''}{time_delta_min} min vs original). "
                f"Awaiting captain approval."
            ),
            "timestamp": ts,
        },
    ]

    # Generate GenAI copilot briefing
    orig_city = str(body.get("originName", "Origin"))
    dest_city = str(body.get("destinationName", "Destination"))
    copilot_data = _generate_copilot_briefing(
        flight_num=flight_num,
        airline=airline,
        orig_city=orig_city,
        dest_city=dest_city,
        storm_wind=storm_wind_speed,
        storm_precip=storm_precipitation,
        clearance_km=clearance_km,
        fuel_delta=(alt_fuel - orig_fuel),
        time_delta=(effective_alt_time - orig_time_min),
        safety_score=safety_score
    )

    return {
        "flightId": flight_id,
        "flightNumber": flight_num,
        "airline": airline,
        "generatedAt": ts,
        "originalRoute": {
            "id": f"{flight_id}-original",
            "points": orig_points,
            "color": "#60a5fa",
            "opacity": 0.7,
            "lineWidth": 4,
            "label": "Original Route",
            "totalDistanceKm": orig_dist_km,
            "estimatedFuelKg": orig_fuel,
            "estimatedTimeMin": orig_time_min,
        },
        "alternateRoute": {
            "id": f"{flight_id}-alternate",
            "points": alt_points,
            "color": "#22d3ee",
            "opacity": 1.0,
            "lineWidth": 6,
            "label": "Alternate Route",
            "totalDistanceKm": alt_dist_km,
            "estimatedFuelKg": alt_fuel,
            "estimatedTimeMin": effective_alt_time,
        },
        "threatZones": [
            {
                "center": [storm_lat, storm_lon],
                "radiusKm": storm_radius_km,
                "severity": "high" if storm_wind_speed >= 80 else "medium" if storm_wind_speed >= 65 else "low",
                "label": "Severe Thunderstorm Cell" if storm_wind_speed >= 80 else "Active Storm Cell" if storm_wind_speed >= 65 else "Convective Activity",
                "windSpeed": storm_wind_speed,
                "precipitation": storm_precipitation,
                "weatherCode": 99 if storm_wind_speed >= 80 else 95 if storm_wind_speed >= 65 else 80,
            }
        ],
        "metrics": {
            "fuelSavingsPercent": fuel_savings_pct,
            "timeDeltaMin": time_delta_min,          # negative = alternate is faster
            "safetyScore": safety_score,
            "originalFuelKg": orig_fuel,
            "alternateFuelKg": alt_fuel,
            "originalTimeMin": orig_time_min,
            "alternateTimeMin": effective_alt_time,
            "holdingTimePenaltyMin": holding_time_penalty,
            "holdingFuelPenaltyKg": holding_fuel_penalty,
        },
        "agentLog": agent_log,
        "copilot": copilot_data,
    }
