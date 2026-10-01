from fastapi import APIRouter
try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health check")
async def health_check():
    # Public endpoint: never expose keys, key fragments, URLs or config here.
    return {"status": "ok", "environment": settings.ENVIRONMENT}
