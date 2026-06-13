from fastapi import APIRouter

from backend.services.aviationstack_service import fetch_active_flights
from backend.services.weather_service import build_weather_summary, fetch_weather_for_flights

router = APIRouter()


@router.get("/weather")
def weather():
    flights, flight_meta = fetch_active_flights()
    observations, weather_meta = fetch_weather_for_flights(flights)
    threats = [observation for observation in observations if observation["riskLevel"] != "LOW"]

    return {
        "items": observations,
        "threats": threats,
        "summary": build_weather_summary(observations),
        "meta": {"flights": flight_meta, "weather": weather_meta},
    }
