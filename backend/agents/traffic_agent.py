from __future__ import annotations

from math import radians, sin, cos, asin, sqrt
from typing import Any


TRAFFIC_REGIONS = [
    {"region": "Delhi Airspace", "latitude": 28.6139, "longitude": 77.209},
    {"region": "Mumbai Airspace", "latitude": 19.076, "longitude": 72.8777},
    {"region": "Nagpur Airspace", "latitude": 21.1458, "longitude": 79.0882},
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(a))


def _traffic_level(aircraft_count: int) -> str:
    if aircraft_count >= 26:
        return "HIGH"
    if aircraft_count >= 11:
        return "MEDIUM"
    return "LOW"


def analyze_traffic(active_flights: list[dict[str, Any]]) -> dict[str, Any]:
    best_region = None
    best_count = -1

    for region in TRAFFIC_REGIONS:
        count = 0
        for flight in active_flights:
            latitude = flight.get("latitude")
            longitude = flight.get("longitude")
            if latitude is None or longitude is None:
                continue
            distance = _haversine_km(float(latitude), float(longitude), region["latitude"], region["longitude"])
            if distance <= 250:
                count += 1
        if count > best_count:
            best_region = region
            best_count = count

    aircraft_count = max(best_count, 0)
    congestion_level = _traffic_level(aircraft_count)

    return {
        "status": "Online",
        "lastScan": None,
        "region": best_region["region"] if best_region else "India Airspace",
        "congestionLevel": congestion_level,
        "aircraftCount": aircraft_count,
        "recommendation": (
            "Increase Separation"
            if congestion_level == "HIGH"
            else "Monitor Closely"
            if congestion_level == "MEDIUM"
            else "Continue Normal Routing"
        ),
        "zones": [
            {
                "region": region["region"],
                "latitude": region["latitude"],
                "longitude": region["longitude"],
                "aircraftCount": sum(
                    1
                    for flight in active_flights
                    if flight.get("latitude") is not None
                    and flight.get("longitude") is not None
                    and _haversine_km(
                        float(flight["latitude"]),
                        float(flight["longitude"]),
                        region["latitude"],
                        region["longitude"],
                    ) <= 250
                ),
                "congestionLevel": _traffic_level(
                    sum(
                        1
                        for flight in active_flights
                        if flight.get("latitude") is not None
                        and flight.get("longitude") is not None
                        and _haversine_km(
                            float(flight["latitude"]),
                            float(flight["longitude"]),
                            region["latitude"],
                            region["longitude"],
                        ) <= 250
                    )
                ),
            }
            for region in TRAFFIC_REGIONS
        ],
    }
