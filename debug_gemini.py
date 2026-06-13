import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path('backend') / '.env')
print('GEMINI_API_KEY loaded:', os.getenv('GEMINI_API_KEY') is not None)

wa={'status':'Online','lastScan':'now','state':'Threat Detected','threatCount':61,'riskScore':100}
ta={'status':'Online','congestionLevel':'HIGH','aircraftCount':26,'region':'Mumbai Airspace','recommendation':'Increase Separation'}
na={'status':'Online','lastScan':'now','activeDecisions':60,'state':'Optimization Active','swarmIntelligence':'Enabled'}

prompt = f"""
You are an aviation operations intelligence system. You are given the current summary state for three monitoring agents: Weather Agent, Traffic Agent, and Navigation Agent.

Current Weather Agent state:
{json.dumps(wa, indent=2)}

Current Traffic Agent state:
{json.dumps(ta, indent=2)}

Current Navigation Agent state:
{json.dumps(na, indent=2)}

Generate an improved JSON object with keys \"weatherAgent\", \"trafficAgent\", and \"navigationAgent\".
Each value should be a JSON object containing the same fields as the current agent, but you may update the following fields to make the card output more expressive:
- weatherAgent: state, summary, threatCount, riskScore
- trafficAgent: recommendation, congestionLevel, region, aircraftCount
- navigationAgent: state, activeDecisions, swarmIntelligence, status

Do not include markdown, backticks, or any extra text. Output only valid JSON.
"""

api_key = os.getenv('GEMINI_API_KEY')
url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}'
payload = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {
        'responseMimeType': 'application/json',
        'temperature': 0.2,
        'topP': 0.9,
        'maxOutputTokens': 3000,
    },
}
headers = {'Content-Type': 'application/json'}
resp = requests.post(url, headers=headers, json=payload, timeout=60)
print('status', resp.status_code)
print('text', resp.text[:2000])
try:
    body = resp.json()
    print('body keys', body.keys())
    candidate_text = body['candidates'][0]['content']['parts'][0]['text']
    print('candidate_text first 1000:', candidate_text[:1000])
    cleaned = candidate_text.strip()
    print('cleaned first 1000:', cleaned[:1000])
    parsed = json.loads(cleaned)
    print('parsed', parsed)
except Exception as e:
    print('exception', type(e).__name__, e)
