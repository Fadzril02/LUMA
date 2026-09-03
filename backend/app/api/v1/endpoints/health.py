"""
[PROJECT_NAME] Health & System Status Endpoints
Company: [COMPANY_NAME]
"""

from fastapi import APIRouter
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
