# ✈️ SkySync Live Demo & Theory Guide

Welcome to the **SkySync Presentation Guide**. This document breaks down the theory behind the platform's rerouting modes in simple, layman's terms so you can deliver a stellar, engaging demo.

---

## 💡 The Core Concept: Multi-Agent Airspace

Before diving into the modes, explain *how* SkySync thinks. SkySync uses a **Multi-Agent System** where specialized AI agents collaborate just like real-world aviation professionals:

1. **Weather Agent (The Meteorologist):** Constantly monitors the skies for storms, turbulence, and high winds.
2. **Traffic Agent (The Radar Operator):** Monitors aircraft positions to prevent congestion and ensure spacing.
3. **Navigation Agent (The Coordinator):** Takes the data from both the Weather and Traffic agents to decide if a flight is safe (`NORMAL`), needs close observation (`ADVISORY`), or must detour immediately (`REROUTE_REQUIRED`).

---

## 1. Single Flight Mode 
> **Analogy:** *A single driver using a smart GPS (like Google Maps) to reroute around a sudden road block.*

### How it works in simple words:
* **The Situation:** A single aircraft (e.g., **AI-3088**) is cruising along its planned route.
* **The Event:** A storm suddenly develops directly in the plane's flight path.
* **The AI Action:** 
  1. The **Weather Agent** detects the storm and raises a red flag.
  2. The **Navigation Agent** calculates a dynamic detour (a smooth mathematical curve) around the storm zone.
  3. The **Generative AI Copilot (Gemini)** draft-reads the telemetry and writes a human-like **Cockpit Briefing** for the captain, along with the exact **ATC Radio Script** so the pilot knows exactly what to say to the tower.
* **The Operator Choice:** The dispatcher reviews the safety, fuel, and time metrics, then clicks **Approve** to update the aircraft's route.

---

## 2. Swarm Mode 🐝
> **Analogy:** *An Air Traffic Control Director managing an entire fleet of flights affected by a sudden regional weather crisis, rerouting everyone in parallel with a single click.*

### How it works in simple words:
* **The Situation:** A massive storm front blocks a major corridor (like the Mumbai-Delhi flight path), impacting **multiple flights simultaneously**.
* **The Event:** The dispatcher toggles **Swarm Mode** and injects the storm.
* **The AI Action:**
  1. SkySync triggers **parallel route computations** for all affected planes at the same time.
  2. Instead of treating each plane individually, the map shows multiple colorful routes detouring around the threat zone.
  3. The dashboard aggregates all metrics into a **Fleet Impact Summary** on the right panel.
* **The Operator Choice:** Instead of approving 5 separate flights one-by-one (which takes valuable time during a crisis), the operator sees the total impact (e.g., *"+1,450 kg Fleet Fuel Impact, +18m Total Delay, 5/5 Flights Safely Rerouted"*). They click **Approve All** to update the entire fleet instantly.

---

## 🎤 Step-by-Step Live Demo Script

Follow these steps to show off the application during your demo:

### **Phase 1: The Setup (Single Flight Mode)**
1. **Show the Map:** Point out the active flights moving across the screen in real-time. Explain that these are live simulated and OpenSky aircraft.
2. **Select Flight AI-3088:** Click on flight **AI-3088** on the map or select it from the sidebar. Show how the route highlights in green and the right panel loads the flight telemetry.
3. **Inject the Crisis:** Click the **"Inject Storm"** button.
   * *What to say:* *"Let's simulate a sudden severe thunderstorm directly in AI-3088's path."*
4. **Explain the Solution:**
   * Point out the **flashing red storm circle** on the map.
   * Point out the **glowing dashed cyan line** showing the proposed detour.
   * Show the **Agent Reasoning Log** showing the step-by-step thoughts of the Weather, Traffic, and Nav agents.
   * Point out the **GenAI Copilot Briefing** and read the first sentence of the ATC script to show how Gemini assists the pilots.
5. **Resolve the Crisis:** Click **Approve Reroute**. Show the success toast and the route updates to the safe detour path.

### **Phase 2: Scaling Up (Swarm Mode)**
1. **Toggle Swarm Mode:** Click the toggle in the top bar to switch from **Single Flight Mode** to **Swarm Mode**.
   * *What to say:* *"In a real crisis, storms don't just affect one plane. They affect entire corridors. Let's toggle Swarm Mode."*
2. **Observe the Fleet:** Notice how 5 different flights with distinct colored paths are now rendered on the map.
3. **Inject Storm:** Click **"Inject Storm"** (Swarm version).
   * *What to say:* *"We are now simulating a regional weather event blocking multiple flight paths."*
4. **Explain the Fleet Dashboard:**
   * Point out the multiple dashed paths evading the storm.
   * Show the **Fleet Impact Summary** on the right panel. Explain how it sums up the total fuel increase and safety indices across all 5 flights.
5. **Approve Fleet Update:** Click **"Approve All Reroutes"** and watch the success animation confirm the update.
