import os
import requests
import json
from datetime import datetime, timezone
from typing import Any, List

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
    Calls the Gemini API (or OpenAI API) to generate a realistic agent reasoning log
    based on the telemetry. Falls back to None if no API key is provided or if the call fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    is_openai = False
    
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            is_openai = True
        else:
            return None

    prompt = f"""
    You are an aviation operations AI. Generate a step-by-step reasoning log for a flight detour.
    Flight Number: {flight_num}
    Airline: {airline}
    Original Fuel: {orig_fuel} kg
    Alternate Fuel: {alt_fuel} kg
    Flight Time Delta: {time_diff} minutes
    Storm Coordinates: {storm_lat}°N, {storm_lon}°E
    
    Output exactly a JSON list of objects. Do not include markdown formatting or backticks, just raw JSON.
    Each object must have the following fields:
    - "agent": string (must be exactly "Weather Agent", "Traffic Agent", or "Navigation Agent")
    - "type": string (must be exactly "SCAN", "ANALYSIS", "COMPUTE", "DECISION", or "METRICS")
    - "message": string (a realistic, natural language operational message explaining the step)
    - "timestamp": string (use current ISO timestamp format)
    
    Generate exactly 6 logical steps in sequence representing the collaborative decision.
    """

    try:
        if is_openai:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2
            }
            response = requests.post(url, headers=headers, json=data, timeout=5)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        else:
            # Gemini Developer API
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            response = requests.post(url, headers=headers, json=data, timeout=5)
            response.raise_for_status()
            content = response.json()["candidates"][0]["content"]["parts"][0]["text"]

        # Parse content as JSON list
        cleaned_content = content.strip()
        if cleaned_content.startswith("```"):
            lines = cleaned_content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned_content = "\n".join(lines).strip()
            
        parsed = json.loads(cleaned_content)
        
        # Inject realistic ISO timestamps
        ts = datetime.now(timezone.utc).isoformat()
        for item in parsed:
            item["timestamp"] = ts
            
        return parsed
    except Exception as e:
        print(f"Gen AI API call failed: {e}")
        return None
