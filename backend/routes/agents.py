from datetime import datetime, timezone

from fastapi import APIRouter, Body

from backend.agents.navigation_agent import navigate_route
from backend.agents.traffic_agent import analyze_traffic
from backend.agents.weather_agent import analyze_weather_observation, summarize_weather_agent
from backend.services.flight_service import get_all_flights
from backend.services.llm_service import generate_agent_card_summaries, generate_chat_response
import os
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

    llm_cards = None
    llm_error = None

    # Demo helper: force a Gemini-like card response locally without calling the API.
    if os.getenv("FORCE_GEMINI_MOCK", "false").lower() == "true":
        llm_cards = {
            "weatherAgent": {
                "status": weather_agent.get("status"),
                "lastScan": weather_agent.get("lastScan"),
                "state": "Critical Threat Detected",
                "summary": "Severe convective cell on planned track with moderate hail and 40 kt wind shear; anticipate deviation and fuel penalty.",
                "threatCount": weather_agent.get("threatCount", 0),
                "riskScore": weather_agent.get("riskScore", 0),
            },
            "trafficAgent": {
                "status": traffic_agent.get("status"),
                "congestionLevel": "HIGH",
                "aircraftCount": traffic_agent.get("aircraftCount", 0),
                "region": traffic_agent.get("region"),
                "recommendation": "Maintain 15 NM separation, vector traffic off the congested flow and prepare for level bust mitigation.",
            },
            "navigationAgent": {
                "status": "Fully Operational",
                "lastScan": navigation_agent.get("lastScan"),
                "activeDecisions": navigation_agent.get("activeDecisions", 0),
                "state": "Route Optimization Active",
                "swarmIntelligence": "Active path optimization engaged; favor altitude block and track offset for weather avoidance.",
            },
        }
    else:
        try:
            llm_cards = generate_agent_card_summaries(weather_agent, traffic_agent, navigation_agent)
        except Exception as exc:  # Defensive: ensure agents still return on LLM failure
            llm_error = str(exc)

    if llm_cards:
        weather_agent.update(llm_cards.get("weatherAgent", {}))
        traffic_agent.update(llm_cards.get("trafficAgent", {}))
        navigation_agent.update(llm_cards.get("navigationAgent", {}))

    return {
        "weatherAgent": weather_agent,
        "trafficAgent": traffic_agent,
        "navigationAgent": navigation_agent,
        "weatherThreats": weather_analysis,
        "trafficZones": traffic_analysis["zones"],
        "navigationDecisions": navigation_decisions,
        "generatedAt": generated_at,
        "meta": {"flights": flight_meta, "weather": weather_meta},
        "llm": {"used": bool(llm_cards), "error": llm_error},
    }


@router.post("/chat")
def chat(body: dict = Body(...)):
    message = body.get("message")
    if not message:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Message is required")
    
    response = generate_chat_response(message)
    if response is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to generate response from pilot assistant")
    
    return {"response": response}
