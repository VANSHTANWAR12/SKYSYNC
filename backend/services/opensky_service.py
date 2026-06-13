from __future__ import annotations
import time
from typing import Any
import requests

# ─── OpenSky endpoints ───────────────────────────────────────────────────────
OPENSKY_STATES_URL  = "https://opensky-network.org/api/states/all"
OPENSKY_FLIGHTS_URL = "https://opensky-network.org/api/flights/all"

# India bounding box
INDIA_BBOX = {"lamin": 6.0, "lomin": 68.0, "lamax": 38.0, "lomax": 98.0}

# ─── ICAO callsign prefix → airline name ─────────────────────────────────────
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

# ─── ICAO airport code → human-readable name ─────────────────────────────────
AIRPORT_NAMES: dict[str, str] = {
    # India — major airports
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
    # Middle East
    "OMDB": "Dubai (DXB)",
    "OBBI": "Bahrain (BAH)",
    "OKBK": "Kuwait (KWI)",
    "OMAA": "Abu Dhabi (AUH)",
    "OOMS": "Muscat (MCT)",
    "OTBD": "Doha (DOH)",
    "OEJN": "Jeddah (JED)",
    "OERK": "Riyadh (RUH)",
    # Asia-Pacific
    "VHHH": "Hong Kong (HKG)",
    "WSSS": "Singapore (SIN)",
    "WMKK": "Kuala Lumpur (KUL)",
    "VTBS": "Bangkok (BKK)",
    "RJTT": "Tokyo (HND)",
    "RKSI": "Seoul (ICN)",
    "ZBAA": "Beijing (PEK)",
    "ZSSS": "Shanghai (PVG)",
    "RPLL": "Manila (MNL)",
    # Europe
    "EGLL": "London (LHR)",
    "LFPG": "Paris (CDG)",
    "EDDF": "Frankfurt (FRA)",
    "EHAM": "Amsterdam (AMS)",
    "LIRF": "Rome (FCO)",
    "LEMD": "Madrid (MAD)",
    # North America
    "KJFK": "New York (JFK)",
    "KLAX": "Los Angeles (LAX)",
    "KORD": "Chicago (ORD)",
    "KIAH": "Houston (IAH)",
    "CYYZ": "Toronto (YYZ)",
    # Oceania
    "YSSY": "Sydney (SYD)",
    "YMML": "Melbourne (MEL)",
}


def _airport_name(icao_code: str | None) -> str:
    """Convert ICAO airport code to a readable name. Falls back to the code itself."""
    if not icao_code:
        return "Unknown"
    return AIRPORT_NAMES.get(icao_code.upper(), icao_code.upper())


# Simple in-process cache for the /flights/all response (valid for 10 min)
_route_cache: dict[str, Any] = {"data": {}, "expires": 0}


def _fetch_route_lookup() -> dict[str, dict[str, str]]:
    """
    Call OpenSky /flights/all for the last 2 hours to get a
    lookup table: icao24 → {origin, destination}
    """
    now = int(time.time())
    if now < _route_cache["expires"]:
        return _route_cache["data"]

    begin = now - 7200   # last 2 hours
    end   = now

    try:
        resp = requests.get(
            OPENSKY_FLIGHTS_URL,
            params={"begin": begin, "end": end},
            timeout=15,
        )
        resp.raise_for_status()
        flights = resp.json()
    except Exception:
        return _route_cache["data"]   # return stale data rather than nothing

    lookup: dict[str, dict[str, str]] = {}
    for f in (flights or []):
        icao24 = (f.get("icao24") or "").lower()
        if icao24:
            lookup[icao24] = {
                "origin":      _airport_name(f.get("estDepartureAirport")),
                "destination": _airport_name(f.get("estArrivalAirport")),
            }

    _route_cache["data"]    = lookup
    _route_cache["expires"] = now + 600   # cache for 10 minutes
    return lookup


def fetch_opensky_flights() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Returns live flights over India with real origin/destination from OpenSky.
    - Positions  → /states/all   (real-time)
    - Routes     → /flights/all  (last 2 h, cached 10 min)
    Cross-referenced by icao24 transponder address.
    """
    # Step 1 — fetch route lookup (cached)
    route_lookup = _fetch_route_lookup()

    # Step 2 — fetch live positions
    try:
        resp = requests.get(OPENSKY_STATES_URL, params=INDIA_BBOX, timeout=10)
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        return [], {"provider": "opensky", "status": "error", "message": str(exc)}

    states = payload.get("states") or []
    if not states:
        return [], {
            "provider": "opensky",
            "status": "empty",
            "message": "No live flights found in Indian airspace via OpenSky.",
        }

    # Step 3 — merge
    normalized: list[dict[str, Any]] = []
    for s in states:
        try:
            icao24   = (s[0] or "").lower()
            callsign = (s[1] or "").strip()
            icao_prefix = callsign[:3].upper() if len(callsign) >= 3 else ""
            airline  = AIRLINE_MAPPING.get(icao_prefix, "Unknown Airline")

            route    = route_lookup.get(icao24, {})
            origin      = route.get("origin",      "Unknown")
            destination = route.get("destination", "Unknown")

            normalized.append({
                "id":          icao24,
                "flightNumber": callsign or icao24 or "Unknown",
                "airline":     airline,
                "origin":      origin,
                "destination": destination,
                "status":      "on-ground" if s[8] else "active",
                "latitude":    s[6],
                "longitude":   s[5],
                "altitude":    int(s[7] or 0) if s[7] else 0,
                "speed":       int((s[9] or 0) * 3.6),   # m/s → km/h
                "heading":     float(s[10]) if s[10] is not None else 0.0,
                "departureCountry": s[2] or "Unknown",
                "arrivalCountry":   "India",
            })
        except (IndexError, TypeError):
            continue

    return normalized, {
        "provider": "opensky",
        "status":   "ready",
        "count":    len(normalized),
        "message":  f"Live positions + real routes from OpenSky ({len(normalized)} flights).",
    }
