"""
SkySync — Reroute Agent Endpoint
POST /api/reroute  { "flightId": "...", "origin": [...], "destination": [...] }
Returns full RerouteData including original route, alternate route,
threat zones, agent reasoning log, and comparison metrics.
"""
from __future__ import annotations
import math
import time
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

    # Fuel estimate: ~3.5 kg/km at cruise (simplified)
    fuel_rate = 3.5
    orig_fuel = round(orig_dist_km * fuel_rate)
    alt_fuel  = round(alt_dist_km  * fuel_rate)

    # Time estimate: ~850 km/h cruise speed
    cruise_speed = 850.0
    orig_time_min = round(orig_dist_km / cruise_speed * 60)
    alt_time_min  = round(alt_dist_km  / cruise_speed * 60)

    # Alternate adds distance but avoids weather hold (saves ~15 min of holding)
    hold_time_saved = 15
    effective_alt_time = max(orig_time_min, alt_time_min - hold_time_saved)

    fuel_savings_pct = round((1 - alt_fuel / max(orig_fuel, 1)) * 100, 1)
    time_savings_min = orig_time_min - effective_alt_time
    safety_score = 91

    # Try calling the Gen AI Service
    from backend.services.llm_service import generate_agent_briefing
    agent_log = generate_agent_briefing(
        flight_num=flight_num,
        airline=airline,
        orig_fuel=orig_fuel,
        alt_fuel=alt_fuel,
        time_diff=alt_time_min - orig_time_min,
        storm_lat=storm_lat,
        storm_lon=storm_lon
    )
    
    if not agent_log:
        # Fall back to template-based generator if API keys are missing
        ts = _now_iso()
        agent_log = [
            {
                "agent": "Weather Agent",
                "type": "SCAN",
                "message": "Severe storm cells detected on original movement vector at original path.",
                "timestamp": ts,
            },
            {
                "agent": "Traffic Agent",
                "type": "ANALYSIS",
                "message": "Air traffic density on alternative vector A is very high.",
                "timestamp": ts,
            },
            {
                "agent": "Weather Agent",
                "type": "ANALYSIS",
                "message": "Alternative vector B avoids storm cells.",
                "timestamp": ts,
            },
            {
                "agent": "Navigation Agent",
                "type": "COMPUTE",
                "message": "Optimal vector calculated to maintain schedule while diverting.",
                "timestamp": ts,
            },
            {
                "agent": "Navigation Agent",
                "type": "DECISION",
                "message": "Final navigation plan confirmed via optimized detour.",
                "timestamp": ts,
            },
            {
                "agent": "Final decision, all agents",
                "type": "DECISION",
                "message": "Reroute to alternate route recommended.",
                "timestamp": ts,
            },
        ]

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
                "radiusKm": 220,
                "severity": "high",
                "label": "Severe Thunderstorm Cell",
                "windSpeed": 84,
                "precipitation": 18,
                "weatherCode": 99,
            }
        ],
        "metrics": {
            "fuelSavingsPercent": fuel_savings_pct,
            "timeSavingsMin": time_savings_min,
            "safetyScore": safety_score,
            "originalFuelKg": orig_fuel,
            "alternateFuelKg": alt_fuel,
            "originalTimeMin": orig_time_min,
            "alternateTimeMin": effective_alt_time,
        },
        "agentLog": agent_log,
    }
