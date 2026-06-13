import os
import json
import time
import random
import logging
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Configure basic logging for debugging LLM issues
logging.basicConfig(level=logging.INFO)

# Allow the model string to be overridden via env for testing/stability
# Default preserves the existing value but can be set to 'gemini-1.5-pro' etc.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def _strip_code_blocks(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        cleaned = "\n".join(cleaned.splitlines()[1:-1]).strip()
    return cleaned


def _post_gemini_request(url: str, headers: dict[str, str], payload: dict[str, Any], *,
                         max_retries: int = 4, base_backoff: float = 1.0) -> requests.Response:
    """
    Post to the Gemini endpoint with exponential backoff and jitter.
    Retries on 429 and 5xx responses.
    """
    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
        except requests.RequestException:
            # network-level error, apply backoff and retry
            response = None

        status = response.status_code if response is not None else None
        # if success or non-retryable code, return immediately
        if response is not None and status < 400:
            return response

        # Determine if we should retry: retry on 429 or 5xx
        should_retry = False
        if response is None:
            should_retry = True
        elif status == 429 or (500 <= status < 600):
            should_retry = True

        if not should_retry:
            # return response (may be 4xx like invalid key)
            return response

        # compute exponential backoff with jitter
        backoff = base_backoff * (2 ** attempt)
        jitter = random.uniform(0, base_backoff)
        sleep_for = backoff + jitter
        logging.info(f"Gemini request retry {attempt+1}/{max_retries}: status={status}, sleeping {sleep_for:.2f}s")
        time.sleep(sleep_for)

    # final attempt without raising here - return last response or raise in caller
    return response


def generate_agent_briefing(
    flight_num: str,
    airline: str,
    orig_fuel: int,
    alt_fuel: int,
    time_diff: int,
    storm_lat: float,
    storm_lon: float,
) -> List[dict[str, Any]] | None:
    """
    Calls the Gemini API to generate a structured agent reasoning log.
    Returns None when the key is missing or the API call fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    logging.info(f"LLM briefing request using model={GEMINI_MODEL} keyPrefix={api_key[:5]}...")

    prompt = f"""
You are an aviation operations AI assistant.
Create a step-by-step reasoning log for a flight reroute due to severe weather.
Include analysis from three agents: Weather Agent, Traffic Agent, and Navigation Agent.

Flight Number: {flight_num}
Airline: {airline}
Original Fuel: {orig_fuel} kg
Alternate Fuel: {alt_fuel} kg
Flight Time Delta: {time_diff} minutes
Storm Coordinates: {storm_lat}°N, {storm_lon}°E

Output EXACTLY a JSON list with 6 objects, no markdown, no backticks, and no extra explanation.
Each object must include these fields:
- "agent": "Weather Agent" or "Traffic Agent" or "Navigation Agent"
- "type": "SCAN", "ANALYSIS", "COMPUTE", "DECISION", or "METRICS"
- "message": a realistic operational sentence
- "timestamp": ISO timestamp string
"""

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "topP": 0.9,
            "maxOutputTokens": 3000,
        },
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = _post_gemini_request(url, headers, payload, max_retries=1)
        response.raise_for_status()
        body = response.json()
        candidate = body["candidates"][0]
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        candidate_text = "".join(str(part.get("text", "")) for part in parts)
        if not candidate_text:
            return None

        cleaned = _strip_code_blocks(candidate_text)
        parsed = json.loads(cleaned)
        ts = datetime.now(timezone.utc).isoformat()
        for item in parsed:
            item["timestamp"] = ts
        return parsed
    except Exception as exc:
        print(f"Gemini reasoning call failed: {exc}")
        return None


def generate_agent_card_summaries(
    weather_agent: dict[str, Any],
    traffic_agent: dict[str, Any],
    navigation_agent: dict[str, Any],
    flight_info: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]] | None:
    """
    Uses Gemini to enrich the UI agent card fields for weather, traffic, and navigation.
    Returns a dict with updated card values or None on failure.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    logging.info(f"LLM card summary request using model={GEMINI_MODEL} keyPrefix={api_key[:5]}...")

    flight_context = ""
    if flight_info:
        flight_context = f"\nFocus your analysis specifically on Flight {flight_info.get('flightNumber', 'UNKNOWN')} ({flight_info.get('airline', 'Unknown')}) routing from {flight_info.get('origin', 'N/A')} to {flight_info.get('destination', 'N/A')}.\n"

    prompt = f"""
You are an aviation operations intelligence system. You are given the current summary state for three monitoring agents: Weather Agent, Traffic Agent, and Navigation Agent.{flight_context}

Current Weather Agent state:
{json.dumps(weather_agent, indent=2)}

Current Traffic Agent state:
{json.dumps(traffic_agent, indent=2)}

Current Navigation Agent state:
{json.dumps(navigation_agent, indent=2)}

Generate an improved JSON object with keys "weatherAgent", "trafficAgent", and "navigationAgent".
Each value should be a JSON object containing the same fields as the current agent, but you may update the following fields to make the card output more expressive in pilot-oriented language:
- weatherAgent: state, summary, threatCount, riskScore
- trafficAgent: recommendation, congestionLevel, region, aircraftCount
- navigationAgent: state, activeDecisions, swarmIntelligence, status

Use concise technical pilot phraseology, including terms like "vector", "deviation", "severe cell", "separation", "altitude block", "fuel impact", and "approach path" when appropriate.
Do not include markdown, backticks, or any extra text. Output only valid JSON.
"""

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "topP": 0.9,
            "maxOutputTokens": 3000,
        },
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = _post_gemini_request(url, headers, payload)
        response.raise_for_status()
        body = response.json()
        candidate = body["candidates"][0]
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        candidate_text = "".join(str(part.get("text", "")) for part in parts)
        if not candidate_text:
            return None

        cleaned = _strip_code_blocks(candidate_text)
        parsed = json.loads(cleaned)

        def parse_int(value, default):
            try:
                if isinstance(value, int):
                    return value
                if isinstance(value, str):
                    digits = "".join(ch for ch in value if ch.isdigit())
                    return int(digits) if digits else default
            except ValueError:
                pass
            return default

        if isinstance(parsed, dict):
            if "weatherAgent" in parsed:
                parsed["weatherAgent"]["threatCount"] = parse_int(
                    parsed["weatherAgent"].get("threatCount"),
                    weather_agent.get("threatCount", 0),
                )
                parsed["weatherAgent"]["riskScore"] = parse_int(
                    parsed["weatherAgent"].get("riskScore"),
                    weather_agent.get("riskScore", 0),
                )
            if "trafficAgent" in parsed:
                parsed["trafficAgent"]["aircraftCount"] = parse_int(
                    parsed["trafficAgent"].get("aircraftCount"),
                    traffic_agent.get("aircraftCount", 0),
                )
            if "navigationAgent" in parsed:
                parsed["navigationAgent"]["activeDecisions"] = parse_int(
                    parsed["navigationAgent"].get("activeDecisions"),
                    navigation_agent.get("activeDecisions", 0),
                )
        return parsed
    except Exception as exc:
        print(f"Gemini agent card summary failed: {exc}")
        return None


def _get_local_chat_fallback(message: str) -> str:
    msg = message.lower()
    if "weather" in msg or "storm" in msg or "rain" in msg or "cloud" in msg or "wind" in msg:
        return "Advisory: Severe weather cell tracking north-northeast. Alternate flight plans have been mapped to bypass convective storm activity and optimize safety limits."
    elif "money" in msg or "cost" in msg or "financial" in msg or "expense" in msg or "budget" in msg:
        return "Cost Analysis: En-route detours reduce fuel-burn and prevent expensive flight holding patterns or diversion landings. Active optimization projects a net savings of approximately $1,200 to $3,500 USD per flight by avoiding airport weather delays."
    elif "traffic" in msg or "congestion" in msg or "separation" in msg or "plane" in msg:
        return "Traffic Alert: Airspace density exceeds nominal thresholds. Navigation system is maintaining 15 NM spacing rules; consider vectoring to secondary flight routes."
    elif "reroute" in msg or "route" in msg or "alternate" in msg:
        return "Navigation Swarm update: Alternate route bypasses weather cells and prevents holding delays, offering optimal fuel-to-time ratios. Awaiting crew selection."
    elif "fuel" in msg or "save" in msg or "burn" in msg or "efficiency" in msg:
        return "Fuel Advisory: Re-routing path avoids weather holding patterns. Although lateral distance increases, it prevents holding loops, resulting in a net fuel saving of approximately 250 to 500 kg depending on the selected flight route."
    elif "hello" in msg or "hi" in msg:
        return "SkySync pilot intelligence assistant online. Ready to evaluate telemetry, weather threats, and airspace optimization plans."
    else:
        return f"Operations Log: Systems monitoring active. Crew query '{message}' recorded. Standard telemetry parameters are normal, and swarm optimization is ready to engage."


def generate_chat_response(user_message: str) -> str | None:
    """
    Uses the Gemini API to answer a user query in operational aviation language.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        if os.getenv("FORCE_GEMINI_MOCK", "false").lower() == "true":
            return "Mock pilot assistant active: provide flight path, weather avoidance, or emergency handling guidance in operational language."
        return _get_local_chat_fallback(user_message)
    logging.info(f"LLM chat request using model={GEMINI_MODEL} keyPrefix={api_key[:5]}...")

    prompt = f"""
You are an aviation operations assistant. Reply to the user's question using concise and technical pilot-oriented phrasing.
Do not use markdown or backticks. Keep responses operational and focused on the problem.

User: {user_message}
"""

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "text/plain",
            "temperature": 0.2,
            "topP": 0.9,
            "maxOutputTokens": 2000,
        },
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = _post_gemini_request(url, headers, payload, max_retries=1)
        response.raise_for_status()
        body = response.json()
        candidate = body.get("candidates", [{}])[0]
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        candidate_text = "".join(str(part.get("text", "")) for part in parts)
        if candidate_text:
            return candidate_text.strip()
        raise ValueError("No text returned from Gemini response")
    except requests.HTTPError as exc:
        response = exc.response
        body_text = response.text if response is not None else ""
        print(f"Gemini assistant call failed: {exc} | status={response.status_code if response is not None else 'unknown'} | body={body_text}")
        return _get_local_chat_fallback(user_message)
    except Exception as exc:
        print(f"Gemini assistant call failed: {exc}")
        if os.getenv("FORCE_GEMINI_MOCK", "false").lower() == "true":
            return "Mock pilot assistant active: guide the crew on weather avoidance, traffic separation, or emergency routing in operational cockpit language."
        return _get_local_chat_fallback(user_message)
