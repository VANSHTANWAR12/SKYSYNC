import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

# Load env variables
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Caching variables to prevent rate limiting
_flights_cache = None
_flights_cache_time = 0.0
CACHE_DURATION = 60.0  # Cache results for 60 seconds

# In-memory route database to resolve real origin/destination
_route_cache = {}

AIRPORT_MAPPING = {
    "VIDP": "Delhi (DEL)",
    "VABB": "Mumbai (BOM)",
    "VOBL": "Bangalore (BLR)",
    "VOMM": "Chennai (MAA)",
    "VECC": "Kolkata (CCU)",
    "VOHS": "Hyderabad (HYD)",
    "VAPO": "Pune (PNQ)",
    "VOGO": "Goa (GOI)",
    "VOCI": "Cochin (COK)",
    "VIAR": "Amritsar (ATQ)",
    "VIJP": "Jaipur (JAI)",
    "VAAH": "Ahmedabad (AMD)",
    "VANP": "Nagpur (NAG)",
    "VILK": "Lucknow (LKO)",
    "VEBS": "Bhubaneswar (BBI)",
    "VEPT": "Patna (PAT)",
    "VIGG": "Gaya (GAY)",
    "VIJO": "Jodhpur (JDH)",
    "VISM": "Srinagar (SXR)",
    "KJFK": "New York (JFK)",
    "EGLL": "London (LHR)",
    "OMDB": "Dubai (DXB)",
    "WSSS": "Singapore (SIN)",
    "OTHH": "Doha (DOH)",
    "OTHB": "Doha (DOH)",
    "VTBS": "Bangkok (BKK)",
    "OBBI": "Bahrain (BAH)",
    "KLAX": "Los Angeles (LAX)",
    "HECA": "Cairo (CAI)",
    "LFPG": "Paris (CDG)",
    "EDDF": "Frankfurt (FRA)",
    "RJTT": "Tokyo (HND)",
    "VHHH": "Hong Kong (HKG)",
    "WMKK": "Kuala Lumpur (KUL)",
}

def lookup_route(callsign: str, auth: tuple[str, str] | None = None, allow_api_query: bool = True) -> tuple[str, str]:
    if not callsign:
        return "Unknown", "Unknown"
        
    callsign_upper = callsign.upper().strip()
    if callsign_upper in _route_cache:
        return _route_cache[callsign_upper]
        
    if not allow_api_query:
        return "Indian Airspace", "En Route"
        
    url = f"https://opensky-network.org/api/routes?callsign={callsign_upper}"
    try:
        response = requests.get(url, auth=auth, timeout=3)
        if response.status_code == 200:
            data = response.json()
            route = data.get("route") or []
            if len(route) >= 2:
                origin_icao = route[0]
                dest_icao = route[1]
                
                origin = AIRPORT_MAPPING.get(origin_icao, origin_icao)
                destination = AIRPORT_MAPPING.get(dest_icao, dest_icao)
                
                _route_cache[callsign_upper] = (origin, destination)
                return origin, destination
            else:
                _route_cache[callsign_upper] = ("Indian Airspace", "En Route")
        elif response.status_code == 404:
            # Route not found, cache to avoid querying again
            _route_cache[callsign_upper] = ("Indian Airspace", "En Route")
    except Exception:
        pass
        
    return "Indian Airspace", "En Route"

def aviationstack_ready() -> bool:
    # Retain for compatibility
    return True

def fetch_active_flights(limit: int = 20) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    global _flights_cache, _flights_cache_time
    
    current_time = time.time()
    # Check if cache is still valid
    if _flights_cache is not None and (current_time - _flights_cache_time) < CACHE_DURATION:
        return _flights_cache

    # Bounding box covering India airspace:
    # lamin=8.0 (south), lomin=68.0 (west), lamax=37.0 (north), lomax=97.0 (east)
    url = "https://opensky-network.org/api/states/all"
    params = {
        "lamin": 8.0,
        "lomin": 68.0,
        "lamax": 37.0,
        "lomax": 97.0
    }
    
    # Optional credentials for higher rate limits (100 req/min)
    OPENSKY_USER = os.getenv("OPENSKY_USERNAME")
    OPENSKY_PASS = os.getenv("OPENSKY_PASSWORD")
    auth = (OPENSKY_USER, OPENSKY_PASS) if OPENSKY_USER and OPENSKY_PASS else None

    try:
        response = requests.get(url, params=params, auth=auth, timeout=15)
        if response.status_code == 200:
            data = response.json()
            states = data.get("states") or []
            items = []
            queries_made = 0
            
            # Map Callsigns to common Indian Airlines for better aesthetics
            airline_mapping = {
                "AIC": "Air India",
                "IGO": "IndiGo",
                "VTI": "Vistara",
                "SEJ": "SpiceJet",
                "IAD": "AirAsia India",
                "LLR": "Alliance Air",
                "GOW": "Go First",
            }
            
            for state in states[:limit]:
                icao24 = state[0]
                callsign = (state[1] or "").strip()
                lng = state[5]
                lat = state[6]
                alt_meters = state[7]
                speed_ms = state[9]
                on_ground = state[8]
                
                if lat is None or lng is None:
                    continue
                
                # Identify Airline
                airline = "Unknown Airline"
                for prefix, name in airline_mapping.items():
                    if callsign.upper().startswith(prefix):
                        airline = name
                        break
                if airline == "Unknown Airline" and state[2]:
                    airline = f"{state[2]} Carrier"
                
                # Format flight number from ICAO (ATC) to commercial IATA format
                flight_number = callsign or f"FL-{icao24.upper()}"
                iata_mapping = {
                    "IGO": "6E",
                    "AIC": "AI",
                    "VTI": "UK",
                    "SEJ": "SG",
                    "IAD": "I5",
                    "GOW": "G8",
                }
                for icao_pref, iata_pref in iata_mapping.items():
                    if flight_number.upper().startswith(icao_pref):
                        suffix = flight_number.upper().replace(icao_pref, "", 1).strip()
                        flight_number = f"{iata_pref} {suffix}"
                        break

                # Look up route dynamically, limiting API calls to 3 per refresh cycle
                callsign_upper = (state[1] or "").strip().upper()
                is_cached = callsign_upper in _route_cache
                allow_api = not is_cached and (queries_made < 3)
                
                origin, destination = lookup_route(callsign, auth, allow_api_query=allow_api)
                if not is_cached and allow_api:
                    queries_made += 1

                items.append({
                    "flightNumber": flight_number,
                    "airline": airline,
                    "origin": origin,
                    "destination": destination,
                    "status": "ground" if on_ground else "active",
                    "latitude": float(lat),
                    "longitude": float(lng),
                    "altitude": int(alt_meters * 3.28084) if alt_meters is not None else 0,
                    "speed": int(speed_ms * 1.94384) if speed_ms is not None else 0,
                })
                
            if items:
                result = (items, {"provider": "opensky", "status": "ready"})
                _flights_cache = result
                _flights_cache_time = current_time
                return result
            
            print("OpenSky API returned no active flights in the India bounding box.")
        else:
            print(f"OpenSky API returned status code {response.status_code}")
    except Exception as exc:
        print(f"OpenSky API request failed: {exc}")

    # Upgrade fallback to a real-time flight path simulator
    routes = [
        {
            "flightNumber": "6E 2104", "airline": "IndiGo",
            "start": [28.6139, 77.209], "end": [19.076, 72.8777],
            "duration": 900, "start_name": "Delhi (DEL)", "end_name": "Mumbai (BOM)",
            "altitude": 32000, "speed": 450
        },
        {
            "flightNumber": "AI 802", "airline": "Air India",
            "start": [19.076, 72.8777], "end": [28.6139, 77.209],
            "duration": 1000, "start_name": "Mumbai (BOM)", "end_name": "Delhi (DEL)",
            "altitude": 34000, "speed": 470
        },
        {
            "flightNumber": "UK 981", "airline": "Vistara",
            "start": [28.6139, 77.209], "end": [12.9716, 77.5946],
            "duration": 1200, "start_name": "Delhi (DEL)", "end_name": "Bangalore (BLR)",
            "altitude": 36000, "speed": 480
        },
        {
            "flightNumber": "SG 402", "airline": "SpiceJet",
            "start": [22.5726, 88.3639], "end": [28.6139, 77.209],
            "duration": 1100, "start_name": "Kolkata (CCU)", "end_name": "Delhi (DEL)",
            "altitude": 28000, "speed": 420
        },
        {
            "flightNumber": "6E 531", "airline": "IndiGo",
            "start": [19.076, 72.8777], "end": [12.9716, 77.5946],
            "duration": 800, "start_name": "Mumbai (BOM)", "end_name": "Bangalore (BLR)",
            "altitude": 30000, "speed": 440
        }
    ]
    
    simulated_items = []
    for i, r in enumerate(routes):
        t = (current_time % r["duration"]) / r["duration"]
        lat = r["start"][0] + t * (r["end"][0] - r["start"][0])
        lng = r["start"][1] + t * (r["end"][1] - r["start"][1])
        
        # Add slight organic jitter so they look like they are flying
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
            "speed": r["speed"]
        })

    result = (simulated_items, {"provider": "opensky", "status": "ready", "message": "Using simulated flight fallback"})
    
    # Cache the simulated fallback for 10 seconds (short duration so it retries soon)
    _flights_cache = result
    _flights_cache_time = current_time - (CACHE_DURATION - 10.0)
    return result
