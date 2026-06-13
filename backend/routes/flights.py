from fastapi import APIRouter

from backend.services.flight_service import get_all_flights

router = APIRouter()


@router.get("/flights")
def flights():
    items, meta = get_all_flights()
    return {"items": items, "count": len(items), "meta": meta}
