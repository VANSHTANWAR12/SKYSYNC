# SkySync ✈️⛈️

SkySync is a real-time, collaborative aviation routing and airspace decision-support dashboard. It allows operators to monitor large aircraft swarms (up to 350+ active flights), dynamically analyze convective weather hazards, inject simulated storm systems, and compute optimized, en-route detours with Multi-Agent Generative AI reasoning logs.

---

## 🚀 Key Features

* **Real-time Airspace Swarm Tracking:** Monitors and displays active flights on an interactive, high-performance tactical map (powered by Leaflet / Mapbox).
* **OpenSky Integration & SSL Bypass:** Gracefully handles live OpenSky Network API streams with a high-performance, simulated fallback switch (`OPENSKY_FORCE_OFFLINE`) to bypass local SSL handshake bottlenecks.
* **Coordinate-Rounded Weather Caching:** Integrates Open-Meteo coordinate tracking with a 5-minute cache layer (0.5-degree grid rounding) to isolate weather fetches and prevent HTTP 429 rate limit blocks.
* **Dynamic En-Route Detours:** Computes storm-avoidance flight paths that start precisely at the aircraft's current coordinates in the sky rather than resetting back to the origin.
* **Generative AI Agent Briefings:** Queries Google Gemini (`gemini-2.5-flash`) or OpenAI to generate collaborative dispatch reasoning logs in real time, featuring coordinated insights from Weather, Traffic, and Navigation agents.
* **Glassmorphism UI & Smooth Scrolling:** Features a premium dark mode dashboard optimized for performance (achieving a smooth 60fps scrolling list by removing heavy CSS backdrop filters and leveraging React hook memoizations).
* **Secure Session Authentication:** Includes a full session-locked user login flow with SQLite credential handling.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Vanilla CSS (Glassmorphism), Leaflet Map (Mapbox tiles)
* **Backend:** FastAPI, Python (Uvicorn server)
* **Database:** SQLite (for session storage and user validation)
* **AI Orchestration:** Google Gemini 2.5 Flash / OpenAI GPT

---

## ⚙️ Project Setup & Installation

### Prerequisites
* Python 3.10+
* Node.js 18+

### 1. Clone & Install Dependencies
Run the unified setup command in the root project folder:
```bash
# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory:
```env
OPEN_METEO_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_TIMEOUT=20

# Gen AI Key (add your key here to enable live LLM reasoning logs)
GEMINI_API_KEY=your_gemini_api_key_here

# Force offline simulated flight fallback to prevent slow OpenSky API hangs
OPENSKY_FORCE_OFFLINE=true

# (Optional) OpenSky credentials
OPENSKY_USERNAME=your_username
OPENSKY_PASSWORD=your_password
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

### 3. Launch the Application
Start both the FastAPI backend (port `8000`) and Vite frontend (port `5173`) concurrently:
```bash
npm run dev
```

---

## 📂 Repository Structure

```
SKYSYNC/
├── backend/
│   ├── routes/              # FastAPI Routers (auth, flights, reroute, weather, health)
│   ├── services/            # Core Python modules (auth, weather, opensky, llm)
│   ├── main.py              # Application entry point
│   ├── .env.example         # Backend template env file
│   └── req.txt              # Backend requirements
├── frontend/
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # React components (Map, Sidebar, FlightInfo, RerouteCard)
│   │   ├── pages/           # Page-level containers (Dashboard, Login)
│   │   ├── hooks/           # Custom React hooks (useReroute)
│   │   ├── App.jsx          # App root router
│   │   └── App.css          # Main glassmorphism stylesheet
│   ├── .env.example         # Frontend template env file
│   └── package.json         # Frontend config
├── package.json             # Root workspace commands
└── AUDIT.md                 # Security and audit logs
```

---

## 🛠️ Development Git Commands

To save, commit, and push your work:

```bash
git add .
git commit -m "update: route changes and GenAI fixes"
git push origin main
```
