from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.agents import router as agents_router
from backend.routes.flights import router as flights_router
from backend.routes.health import router as health_router
from backend.routes.weather import router as weather_router
from backend.routes.reroute import router as reroute_router
from backend.routes.chat import router as chat_router

app = FastAPI(title="SkySync API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flights_router, prefix="/api")
app.include_router(weather_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(reroute_router, prefix="/api")
app.include_router(chat_router,   prefix="/api")
