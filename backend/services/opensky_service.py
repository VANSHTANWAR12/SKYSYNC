from __future__ import annotations
import os
import time
import requests
from typing import Any
from pathlib import Path
from dotenv import load_dotenv

# Load env variables
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# OpenSky endpoints
OPENSKY_STATES_URL  = "https://opensky-network.org/api/states/all"
OPENSKY_ROUTES_URL  = "https://opensky-network.org/api/routes"

# India bounding box
INDIA_BBOX = {"lamin": 6.0, "lomin": 68.0, "lamax": 38.0, "lomax": 98.0}

AIRLINE_MAPPING = {
    "AIC": "Air India",
    "IGO": "IndiGo",
    "VTI": "Vistara",
    "SEJ": "SpiceJet",
    "AKJ": "Akasa Air",
    "IAD": "AirAsia India",
    "LLR": "Alliance Air",
    "VXP": "Akasa Air",
}

AIRPORT_NAMES = {
    "VIDP": "Delhi (DEL)",
    "VABB": "Mumbai (BOM)",
    "VOBL": "Bengaluru (BLR)",
    "VECC": "Kolkata (CCU)",
    "VOMM": "Chennai (MAA)",
    "VOHS": "Hyderabad (HYD)",
    "VAAH": "Ahmedabad (AMD)",
    "VOCI": "Kochi (COK)",
    "VEGT": "Guwahati (GAU)",
    "VISR": "Srinagar (SXR)",
    "VAPO": "Pune (PNQ)",
    "VILK": "Lucknow (LKO)",
    "VIJP": "Jaipur (JAI)",
    "VEBS": "Bhubaneswar (BBI)",
    "VEPT": "Patna (PAT)",
    "VAID": "Indore (IDR)",
    "VANP": "Nagpur (NAG)",
    "VOTR": "Tiruchirappalli (TRZ)",
    "VOCL": "Calicut (CCJ)",
    "VOMD": "Madurai (IXM)",
    "VEGK": "Gorakhpur (GOP)",
    "VIAG": "Agra (AGR)",
    "VAPR": "Aurangabad (IXU)",
    "VERC": "Raipur (RPR)",
    "VEJH": "Jharsuguda (JRG)",
    "VOBZ": "Vijayawada (VGA)",
    "VOTV": "Thiruvananthapuram (TRV)",
    "VOPC": "Pondicherry (PNY)",
    "VIAR": "Amritsar (ATQ)",
    "VIDD": "Hindon (HDO)",
    "VIBN": "Varanasi (VNS)",
    "VECA": "Bagdogra (IXB)",
    "VEBD": "Bagdogra (IXB)",
    "VORY": "Mangaluru (IXE)",
}

def _airport_name(icao_code: str | None) -> str:
    if not icao_code:
        return "Unknown"
    return AIRPORT_NAMES.get(icao_code.upper(), icao_code.upper())

# In-memory caches
_flights_cache: tuple[list[dict[str, Any]], dict[str, Any]] | None = None
_flights_cache_time: float = 0.0
CACHE_DURATION = 60.0

_route_cache: dict[str, tuple[str, str]] = {}

def lookup_route(callsign: str, auth: tuple[str, str] | None = None, allow_api_query: bool = True) -> tuple[str, str]:
    if not callsign:
        return "Unknown", "Unknown"
    
    callsign_upper = callsign.upper().strip()
    if callsign_upper in _route_cache:
        return _route_cache[callsign_upper]
        
    if not allow_api_query:
        return "Indian Airspace", "En Route"
        
    url = f"{OPENSKY_ROUTES_URL}?callsign={callsign_upper}"
    try:
        response = requests.get(url, auth=auth, timeout=3)
        if response.status_code == 200:
            data = response.json()
            route = data.get("route") or []
            if len(route) >= 2:
                origin = _airport_name(route[0])
                destination = _airport_name(route[1])
                _route_cache[callsign_upper] = (origin, destination)
                return origin, destination
        # Cache negative/404 results as well to avoid spamming
        _route_cache[callsign_upper] = ("Indian Airspace", "En Route")
    except Exception:
        pass
        
    return "Indian Airspace", "En Route"

FORCE_OFFLINE = os.getenv("OPENSKY_FORCE_OFFLINE", "true").lower() == "true"

def fetch_opensky_flights() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    global _flights_cache, _flights_cache_time
    now = time.time()
    
    if FORCE_OFFLINE:
        return _get_simulated_fallback(now)
        
    if _flights_cache is not None and (now - _flights_cache_time) < CACHE_DURATION:
        return _flights_cache

    OPENSKY_USER = os.getenv("OPENSKY_USERNAME")
    OPENSKY_PASS = os.getenv("OPENSKY_PASSWORD")
    auth = (OPENSKY_USER, OPENSKY_PASS) if OPENSKY_USER and OPENSKY_PASS else None

    try:
        resp = requests.get(OPENSKY_STATES_URL, params=INDIA_BBOX, auth=auth, timeout=10)
        resp.raise_for_status()
        payload = resp.json()
        states = payload.get("states") or []
    except Exception as exc:
        # If API fails, return simulated fallback cached for 10 seconds
        fallback_data = _get_simulated_fallback(now)
        _flights_cache = fallback_data
        # Set cache time such that it expires in 10s
        _flights_cache_time = now - (CACHE_DURATION - 10.0)
        return fallback_data

    normalized: list[dict[str, Any]] = []
    queries_made = 0
    
    for s in states:
        try:
            icao24   = (s[0] or "").lower()
            callsign = (s[1] or "").strip()
            if not s[6] or not s[5]:  # Latitude or longitude missing
                continue
                
            icao_prefix = callsign[:3].upper() if len(callsign) >= 3 else ""
            airline  = AIRLINE_MAPPING.get(icao_prefix, "Unknown Airline")

            # Lazy route lookup (max 3 api requests per refresh cycle)
            callsign_upper = callsign.upper()
            is_cached = callsign_upper in _route_cache
            allow_api = not is_cached and (queries_made < 3)
            
            origin, destination = lookup_route(callsign, auth, allow_api_query=allow_api)
            if not is_cached and allow_api:
                queries_made += 1

            heading = int(s[10]) if s[10] is not None else 0

            # Convert flight number format (e.g. IGO123 -> 6E 123)
            flight_number = callsign or f"FL-{icao24.upper()}"
            iata_mapping = {
                "IGO": "6E",
                "AIC": "AI",
                "VTI": "UK",
                "SEJ": "SG",
                "IAD": "I5",
                "LLR": "Alliance Air",
            }
            for icao_pref, iata_pref in iata_mapping.items():
                if flight_number.upper().startswith(icao_pref):
                    suffix = flight_number.upper().replace(icao_pref, "", 1).strip()
                    flight_number = f"{iata_pref} {suffix}"
                    break

            normalized.append({
                "id":          icao24,
                "flightNumber": flight_number,
                "airline":     airline,
                "origin":      origin,
                "destination": destination,
                "status":      "on-ground" if s[8] else "active",
                "latitude":    float(s[6]),
                "longitude":   float(s[5]),
                "altitude":    int(s[7] * 3.28084) if s[7] is not None else 0, # meters to feet
                "speed":       int((s[9] or 0) * 3.6),   # m/s → km/h
                "heading":     heading,
                "departureCountry": s[2] or "Unknown",
                "arrivalCountry":   "India",
            })
        except (IndexError, TypeError):
            continue

    meta = {
        "provider": "opensky",
        "status":   "ready",
        "count":    len(normalized),
        "message":  f"Live positions + real routes from OpenSky ({len(normalized)} flights).",
    }
    
    result = (normalized, meta)
    _flights_cache = result
    _flights_cache_time = now
    return result

def _get_simulated_fallback(current_time: float) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # India simulated routes
    routes = [
        {
            "flightNumber": "6E 2104", "airline": "IndiGo",
            "start": [28.6139, 77.209], "end": [19.076, 72.8777],
            "duration": 900, "start_name": "Delhi (DEL)", "end_name": "Mumbai (BOM)",
            "altitude": 32000, "speed": 830, "heading": 195
        },
        {
            "flightNumber": "AI 802", "airline": "Air India",
            "start": [19.076, 72.8777], "end": [28.6139, 77.209],
            "duration": 1000, "start_name": "Mumbai (BOM)", "end_name": "Delhi (DEL)",
            "altitude": 34000, "speed": 850, "heading": 15
        },
        {
            "flightNumber": "UK 981", "airline": "Vistara",
            "start": [28.6139, 77.209], "end": [12.9716, 77.5946],
            "duration": 1200, "start_name": "Delhi (DEL)", "end_name": "Bengaluru (BLR)",
            "altitude": 36000, "speed": 870, "heading": 181
        },
        {
            "flightNumber": "SG 402", "airline": "SpiceJet",
            "start": [22.5726, 88.3639], "end": [28.6139, 77.209],
            "duration": 1100, "start_name": "Kolkata (CCU)", "end_name": "Delhi (DEL)",
            "altitude": 28000, "speed": 790, "heading": 305
        },
        {
            "flightNumber": "6E 531", "airline": "IndiGo",
            "start": [19.076, 72.8777], "end": [12.9716, 77.5946],
            "duration": 800, "start_name": "Mumbai (BOM)", "end_name": "Bengaluru (BLR)",
            "altitude": 30000, "speed": 810, "heading": 145
        }
    ]
    
    simulated_items = []
    for i, r in enumerate(routes):
        t = (current_time % r["duration"]) / r["duration"]
        lat = r["start"][0] + t * (r["end"][0] - r["start"][0])
        lng = r["start"][1] + t * (r["end"][1] - r["start"][1])
        
        # Add organic jitter
        import random
        random.seed(i + int(current_time / 10))
        lat += random.uniform(-0.03, 0.03)
        lng += random.uniform(-0.03, 0.03)
        
        simulated_items.append({
            "id": f"sim-{i}",
            "flightNumber": r["flightNumber"],
            "airline": r["airline"],
            "origin": r["start_name"],
            "destination": r["end_name"],
            "status": "active",
            "latitude": round(lat, 5),
            "longitude": round(lng, 5),
            "altitude": r["altitude"],
            "speed": r["speed"],
            "heading": r["heading"],
            "departureCountry": "India",
            "arrivalCountry": "India",
        })

    return simulated_items, {
        "provider": "opensky",
        "status": "ready",
        "message": "Using simulated flight fallback (OpenSky offline)."
    }
