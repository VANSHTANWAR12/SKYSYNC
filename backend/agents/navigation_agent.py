from __future__ import annotations
from typing import Any

def navigate_route(flight: dict[str, Any], weather: dict[str, Any] | None, traffic: dict[str, Any] | None) -> dict[str, Any]:
    """
    Simulates a Navigation Agent that decides on rerouting based on Weather and Traffic.
    """
    weather_risk = weather.get("riskLevel", "LOW") if weather else "LOW"
    traffic_congestion = traffic.get("congestionLevel", "LOW") if traffic else "LOW"
    
    decisions = []
    reasoning = []
    
    if weather_risk == "CRITICAL":
        decisions.append("REROUTE")
        reasoning.append("Critical weather threat (Storm/Extreme Wind) in current corridor.")
    elif weather_risk == "HIGH":
        decisions.append("MONITOR_CLOSELY")
        reasoning.append("High weather risk (Heavy Rain/Strong Wind) detected.")

    if traffic_congestion == "HIGH":
        decisions.append("HOLD" if "REROUTE" not in decisions else "REROUTE_HEAVY")
        reasoning.append("Extreme airspace congestion in target sector.")
    
    status = "STABLE"
    if "REROUTE" in decisions or "REROUTE_HEAVY" in decisions:
        status = "REROUTE_REQUIRED"
    elif "HOLD" in decisions or "MONITOR_CLOSELY" in decisions:
        status = "ADVISORY"

    return {
        "flightNumber": flight.get("flightNumber"),
        "status": status,
        "decisions": decisions,
        "reasoning": " ".join(reasoning) if reasoning else "No navigation threats detected. Maintaining flight plan.",
        "fuelEfficiency": "OPTIMAL" if status == "STABLE" else "REDUCED",
    }
