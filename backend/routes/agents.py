from datetime import datetime, timezone

from fastapi import APIRouter

from backend.agents.navigation_agent import navigate_route
from backend.agents.traffic_agent import analyze_traffic
from backend.agents.weather_agent import analyze_weather_observation, summarize_weather_agent
from backend.services.flight_service import get_all_flights
from backend.services.weather_service import fetch_weather_for_flights

router = APIRouter()


@router.get("/agents")
def agents():
    generated_at = datetime.now(timezone.utc).isoformat()
    flights, flight_meta = get_all_flights()
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

    # New Navigation Agent Swarm Logic
    navigation_decisions = []
    for flight in flights:
        f_num = flight.get("flightNumber")
        w_obs = next((o for o in weather_analysis if o.get("flightNumber") == f_num), None)
        # Find if this flight is in a high traffic zone
        t_zone = next((z for z in traffic_analysis["zones"] if z.get("aircraftCount", 0) > 2), None)
        
        decision = navigate_route(flight, w_obs, t_zone)
        navigation_decisions.append(decision)

    navigation_agent = {
        "status": "Online",
        "lastScan": generated_at,
        "activeDecisions": len([d for d in navigation_decisions if d["status"] != "STABLE"]),
        "state": "Optimization Active",
        "swarmIntelligence": "Enabled",
    }

    return {
        "weatherAgent": weather_agent,
        "trafficAgent": traffic_agent,
        "navigationAgent": navigation_agent,
        "weatherThreats": weather_analysis,
        "trafficZones": traffic_analysis["zones"],
        "navigationDecisions": navigation_decisions,
        "generatedAt": generated_at,
        "meta": {"flights": flight_meta, "weather": weather_meta},
    }
