from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {
        "frontend": "ready",
        "backend": "ready",
        "aviationstack": "ready",
        "weather": "ready",
    }
