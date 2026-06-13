from fastapi import APIRouter

from backend.services.aviationstack_service import fetch_active_flights

router = APIRouter()


@router.get("/live-flights")
def live_flights():
    items, meta = fetch_active_flights()
    return {"items": items, "count": len(items), "meta": meta}
