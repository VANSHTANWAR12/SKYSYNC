"""
SkySync — AI Copilot Chat Endpoint
POST /api/chat  { "message": "...", "flights": [...], "weather": {...} }
Sends user message + live airspace context to Gemini and returns a smart response.
Falls back to a rule-based reply when no API key is configured.
"""
from __future__ import annotations
import os
import json
import requests
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_system_prompt(flights: list[dict], weather: dict | None) -> str:
    """Build a rich system prompt that includes live airspace context."""

    flight_summary = ""
    if flights:
        lines = []
        for f in flights[:10]:  # cap at 10 to keep prompt short
            lines.append(
                f"  - {f.get('flightNumber','?')} ({f.get('airline','?')}): "
                f"{f.get('origin','?')} → {f.get('destination','?')}, "
                f"status={f.get('status','?')}, "
                f"alt={f.get('altitude','?')}ft, speed={f.get('speed','?')}kt"
            )
        flight_summary = "LIVE FLIGHTS IN AIRSPACE:\n" + "\n".join(lines)
    else:
        flight_summary = "LIVE FLIGHTS: No flight data available right now."

    weather_summary = ""
    if weather:
        threats = weather.get("threats", [])
        if threats:
            w_lines = []
            for t in threats[:5]:
                w_lines.append(
                    f"  - {t.get('weatherThreat','Storm')} at "
                    f"({t.get('latitude','?')},{t.get('longitude','?')}), "
                    f"risk={t.get('riskLevel','?')}, wind={t.get('windSpeed','?')}km/h"
                )
            weather_summary = "ACTIVE WEATHER THREATS:\n" + "\n".join(w_lines)
        else:
            weather_summary = "ACTIVE WEATHER THREATS: Skies clear, no active threats."
    else:
        weather_summary = "ACTIVE WEATHER THREATS: Weather data unavailable."

    return f"""You are the AI Copilot for SkySync, an advanced aviation airspace intelligence system monitoring Indian airspace in real time.

Your role is to assist air traffic controllers, dispatch operators, and pilots by answering questions about:
- Live flights currently in the airspace (see data below)
- Weather threats and storm cells
- Flight rerouting, fuel, and time calculations
- Aviation terminology, procedures, and Indian airspace regulations
- General aviation knowledge (aircraft types, airlines, airports, ICAO codes, etc.)

Current UTC time: {_now_iso()}

{flight_summary}

{weather_summary}

INSTRUCTIONS:
- Be concise, professional, and accurate. Use aviation terminology where appropriate.
- When referencing live flights, use the exact data provided above.
- If asked about a specific flight not in the list, say it is not currently tracked.
- If asked something outside aviation, politely redirect to airspace topics.
- Keep responses to 2-4 sentences unless a detailed answer is genuinely needed.
- Do NOT use markdown formatting, bullet points, or headers — plain prose only.
- Sign off as "AI Copilot" — do not impersonate a human.
"""


@router.post("/chat")
def ai_chat(body: dict = Body(...)) -> dict[str, Any]:
    """
    Accept a free-text message from the operator console and return
    a Gemini-powered response grounded in live airspace context.
    """
    user_message = str(body.get("message", "")).strip()
    flights      = body.get("flights", [])
    weather      = body.get("weather", None)

    if not user_message:
        return {"reply": "No message received.", "timestamp": _now_iso()}

    api_key = os.getenv("GEMINI_API_KEY")
    system_prompt = _build_system_prompt(flights, weather)

    if api_key:
        try:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={api_key}"
            )
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_prompt}]
                },
                "contents": [
                    {"role": "user", "parts": [{"text": user_message}]}
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 300,
                },
            }
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                result = resp.json()
                reply_text = (
                    result["candidates"][0]["content"]["parts"][0]["text"]
                    .strip()
                )
                return {"reply": reply_text, "source": "gemini", "timestamp": _now_iso()}
        except Exception as exc:
            # Fall through to rule-based fallback
            pass

    # ── Rule-based fallback (no API key or Gemini error) ───────────────────────
    lower = user_message.lower()

    if any(w in lower for w in ["how many", "count", "number of"]) and "flight" in lower:
        count = len(flights)
        reply = (
            f"There are currently {count} flights being tracked in Indian airspace."
            if count else
            "No flights are currently tracked in the system."
        )
    elif any(w in lower for w in ["weather", "storm", "rain", "thunder", "wind"]):
        threats = (weather or {}).get("threats", [])
        if threats:
            reply = (
                f"I'm detecting {len(threats)} active weather threats in the airspace. "
                f"The most severe is classified as {threats[0].get('riskLevel','HIGH')} risk. "
                "Use /storm to simulate rerouting or click Inject Storm on the map."
            )
        else:
            reply = "Current weather scan shows clear skies across monitored corridors. No active storm cells detected."
    elif any(w in lower for w in ["fuel", "consumption", "range"]):
        reply = (
            "Fuel burn in SkySync is estimated at 3.5 kg/km at cruise altitude (FL360). "
            "Storm holding patterns typically add 400–900 kg of additional fuel depending on severity. "
            "Use Inject Storm on any flight to see precise fuel delta calculations."
        )
    elif any(w in lower for w in ["reroute", "detour", "alternate", "avoid"]):
        reply = (
            "To reroute a flight, select it from the Fleet List and click Inject Storm, "
            "or type /reroute [flight number] in this console. "
            "The Navigation Agent will compute a weather-avoidance corridor within seconds."
        )
    elif any(w in lower for w in ["hello", "hi", "hey", "help"]):
        reply = (
            "AI Copilot online. I can answer questions about live flights, weather threats, "
            "rerouting procedures, fuel calculations, or general aviation topics. "
            "Type a question or use /reroute, /storm, or /clear for direct commands."
        )
    elif any(w in lower for w in ["airport", "icao", "iata"]):
        reply = (
            "SkySync monitors routes across major Indian airports including DEL (Delhi), "
            "BOM (Mumbai), MAA (Chennai), CCU (Kolkata), BLR (Bengaluru), and HYD (Hyderabad). "
            "Ask about a specific airport or route for more details."
        )
    elif "speed" in lower or "altitude" in lower or "cruise" in lower:
        reply = (
            "Typical narrow-body cruise speed is ~828 km/h (Mach 0.78) at FL350–FL380. "
            "Wide-body aircraft cruise at ~900 km/h (Mach 0.85). "
            "SkySync uses 850 km/h as a standard cruise estimate for ETA calculations."
        )
    else:
        # Generic fallback
        flight_count = len(flights)
        reply = (
            f"AI Copilot is monitoring {flight_count} active flights in Indian airspace. "
            "I can answer questions about specific flights, weather threats, routing, fuel, or aviation procedures. "
            "What would you like to know?"
        )

    return {"reply": reply, "source": "fallback", "timestamp": _now_iso()}
