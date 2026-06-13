from __future__ import annotations

from typing import Any


def analyze_weather_observation(observation: dict[str, Any]) -> dict[str, Any]:
    wind_speed = float(observation.get("windSpeed") or 0)
    precipitation = float(observation.get("precipitation") or 0)
    weather_code = int(observation.get("weatherCode") or 0)

    if wind_speed > 70 or weather_code in {95, 96, 99}:
        risk_level = "CRITICAL"
        weather_threat = observation.get("weatherThreat") or "Storm"
        recommendation = "Immediate Reroute Required"
    elif wind_speed > 50:
        risk_level = "HIGH"
        weather_threat = observation.get("weatherThreat") or "Dangerous Wind"
        recommendation = "Reroute Recommended"
    elif precipitation >= 2 or weather_code in {51, 53, 55, 61, 63, 65, 80, 81, 82, 66, 67}:
        risk_level = "HIGH"
        weather_threat = observation.get("weatherThreat") or "Heavy Rain"
        recommendation = "Reroute Recommended"
    else:
        risk_level = "LOW"
        weather_threat = observation.get("weatherThreat") or "Clear"
        recommendation = "Continue Monitoring"

    return {
        "flightNumber": observation.get("flightNumber"),
        "latitude": observation.get("latitude"),
        "longitude": observation.get("longitude"),
        "riskLevel": risk_level,
        "weatherThreat": weather_threat,
        "recommendation": recommendation,
        "windSpeed": wind_speed,
        "precipitation": precipitation,
        "weatherCode": weather_code,
    }


def summarize_weather_agent(observations: list[dict[str, Any]]) -> dict[str, Any]:
    threat_count = sum(1 for observation in observations if observation.get("riskLevel") in {"HIGH", "CRITICAL"})
    critical_count = sum(1 for observation in observations if observation.get("riskLevel") == "CRITICAL")
    risk_score = min(100, threat_count * 18 + critical_count * 28)

    return {
        "status": "Online",
        "lastScan": observations[0].get("flightNumber") if observations else None,
        "threatCount": threat_count,
        "riskScore": risk_score,
        "state": "Active Monitoring" if threat_count == 0 else "Threat Detected",
    }
