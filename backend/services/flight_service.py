from __future__ import annotations
import time
import random
import math
from typing import Any
from backend.services.opensky_service import fetch_opensky_flights

# Simple in-memory cache
_cache = {
    "flights": [],
    "meta": {},
    "last_updated": 0
}
CACHE_TTL = 30 

def _calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    d_lon = lon2_rad - lon1_rad
    y = math.sin(d_lon) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(d_lon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360


def _generate_mega_swarm(count: int = 350) -> list[dict[str, Any]]:
    airlines = ["Air India", "IndiGo", "Vistara", "SpiceJet", "Akasa Air", "AirAsia India", "Alliance Air"]
    hubs = [
        ("DELHI (DEL)", 28.6, 77.2), ("MUMBAI (BOM)", 19.1, 72.8), 
        ("BENGALURU (BLR)", 12.9, 77.6), ("KOLKATA (CCU)", 22.5, 88.3),
        ("CHENNAI (MAA)", 13.0, 80.2), ("HYDERABAD (HYD)", 17.4, 78.4),
        ("AHMEDABAD (AMD)", 23.0, 72.5), ("KOCHI (COK)", 9.9, 76.2),
        ("GUWAHATI (GAU)", 26.1, 91.7), ("SRINAGAR (SXR)", 34.0, 74.8),
        ("PUNE (PNQ)", 18.5, 73.9), ("LUCKNOW (LKO)", 26.8, 80.9),
        ("JAIPUR (JAI)", 26.8, 75.8), ("BHUBANESWAR (BBI)", 20.2, 85.8),
        ("PATNA (PAT)", 25.5, 85.0), ("INDORE (IDR)", 22.7, 75.8)
    ]
    
    swarm = []
    for i in range(count):
        r = random.Random(i)
        origin = r.choice(hubs)
        dest = r.choice(hubs)
        while dest == origin: dest = r.choice(hubs)
        
        # Interpolate a position along the path from origin to destination (e.g., 10% to 90% along the path)
        t = r.uniform(0.1, 0.9)
        lat = origin[1] + t * (dest[1] - origin[1]) + r.uniform(-0.2, 0.2)
        lon = origin[2] + t * (dest[2] - origin[2]) + r.uniform(-0.2, 0.2)
        
        bearing = _calculate_bearing(origin[1], origin[2], dest[1], dest[2])
        
        swarm.append({
            "id": f"MEGA-SATURATION-{i}",
            "flightNumber": f"{r.choice(['AI','6E','UK','SG', 'QP', 'I5'])}-{r.randint(100, 9999)}",
            "airline": r.choice(airlines),
            "origin": origin[0],
            "destination": dest[0],
            "status": "active",
            "latitude": lat,
            "longitude": lon,
            "heading": bearing,
            "altitude": r.randint(28000, 42000),
            "speed": r.randint(750, 950),
            "departureCountry": "India",
            "arrivalCountry": "India",
        })
    return swarm

def get_all_flights() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    now = time.time()
    if _cache["flights"] and (now - _cache["last_updated"]) < CACHE_TTL:
        jittered = []
        for f in _cache["flights"]:
            jf = f.copy()
            if "MEGA" in str(f.get("id")):
                jf["latitude"] = f["latitude"] + random.uniform(-0.015, 0.015)
                jf["longitude"] = f["longitude"] + random.uniform(-0.015, 0.015)
            jittered.append(jf)
        return jittered, _cache["meta"]

    items, meta = fetch_opensky_flights()
    
    # Airspace Saturation Mode: 350 Flights
    if len(items) < 350:
        needed = 350 - len(items)
        items = items + _generate_mega_swarm(needed)
        meta["status"] = "airspace_saturated"
        meta["message"] = "India-Wide Airspace Saturation: 350 flight agents active."
    
    _cache["flights"] = items
    _cache["meta"] = meta
    _cache["last_updated"] = now
    return items, meta
