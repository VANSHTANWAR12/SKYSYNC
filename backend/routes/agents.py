from datetime import datetime, timezone

from fastapi import APIRouter

from backend.agents.traffic_agent import analyze_traffic
from backend.agents.weather_agent import analyze_weather_observation, summarize_weather_agent
from backend.services.aviationstack_service import fetch_active_flights
from backend.services.weather_service import fetch_weather_for_flights

router = APIRouter()


@router.get("/agents")
def agents():
    generated_at = datetime.now(timezone.utc).isoformat()
    flights, flight_meta = fetch_active_flights()
    weather_observations, weather_meta = fetch_weather_for_flights(flights)
    weather_analysis = [analyze_weather_observation(observation) for observation in weather_observations]
    traffic_analysis = analyze_traffic(flights)

    weather_agent = summarize_weather_agent(weather_analysis)
    weather_agent.update(
        {
            "status": "Online",
            "lastScan": generated_at,
            "state": "Threat Detected" if weather_agent["threatCount"] else "Monitoring",
        }
    )

    traffic_agent = {
        "status": "Online",
        "lastScan": generated_at,
        "congestionLevel": traffic_analysis["congestionLevel"],
        "aircraftCount": traffic_analysis["aircraftCount"],
        "region": traffic_analysis["region"],
        "recommendation": traffic_analysis["recommendation"],
        "zones": traffic_analysis["zones"],
    }

    return {
        "weatherAgent": weather_agent,
        "trafficAgent": traffic_agent,
        "weatherThreats": weather_analysis,
        "trafficZones": traffic_analysis["zones"],
        "generatedAt": generated_at,
        "meta": {"flights": flight_meta, "weather": weather_meta},
    }
