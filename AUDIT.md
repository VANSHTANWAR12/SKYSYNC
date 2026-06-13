# SkySync Repository Audit

## Findings

- Root startup was missing. A developer had to start Vite and FastAPI separately.
- `backend/main.py` used top-level imports that were sensitive to the current working directory.
- `/api/flights`, `/api/weather`, and `/api/agents` could raise 502 responses when upstream services failed or keys were missing.
- `/api/health` did not exist.
- AviationStack usage was split between two services, including one unused duplicate service.
- Open-Meteo errors were not isolated from route handlers.
- Mapbox initialization could proceed without a valid `VITE_MAPBOX_TOKEN`.
- Old history contains a committed AviationStack key in `backend/.env`.
- Old history contains a committed Mapbox fallback token in `frontend/src/components/FlightMap.jsx`.
- `frontend/.env` and `backend/.env` appeared in history and must be treated as compromised.
- Python `__pycache__` files were tracked.
- Root `.gitignore` was empty.
- `frontend/src/flightmap.jsx`, `frontend/src/flightinfo.jsx`, and `frontend/src/agentpanel.jsx` are compatibility re-exports; the active app imports from `frontend/src/components`.

## Remediation In Current Tree

- Added root `package.json` with `npm run dev` to start FastAPI and Vite together through `concurrently`.
- Added `backend/__init__.py` and package-safe backend imports.
- Added `GET /api/health`.
- Centralized AviationStack logic in `backend/services/aviationstack_service.py`.
- Removed duplicate `backend/services/live_flights.py`.
- Added graceful provider metadata for missing keys, rate limits, empty responses, and upstream failures.
- Added Open-Meteo threat detection, risk scoring, and weather summary helpers.
- Updated frontend service calls to use one API helper.
- Updated Mapbox to use only `import.meta.env.VITE_MAPBOX_TOKEN`.
- Added user-facing Mapbox configuration error when the token is missing.
- Added `frontend/.env.example` and `backend/.env.example`.
- Updated `.gitignore` for env files, dependencies, builds, and Python caches.

## GitHub Secret History Fix

Current source no longer contains hard-coded Mapbox or AviationStack secrets, but the Git history still does. Rotate the exposed AviationStack and Mapbox tokens, then rewrite history before pushing:

```bash
git filter-repo --path backend/.env --invert-paths
git filter-repo --replace-text replacements.txt

After rewriting:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease origin main
```

If this repository is shared, coordinate the force push first.
