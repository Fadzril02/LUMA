"""
Smart Academic Assessment System - Health & Diagnostics Endpoints
"""

from fastapi import APIRouter
try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health check")
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "company": settings.COMPANY_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }
