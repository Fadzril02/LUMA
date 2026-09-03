"""
[PROJECT_NAME] API v1 Router Aggregator
Company: [COMPANY_NAME]
"""

from fastapi import APIRouter
from backend.app.api.v1.endpoints import audit, health, courses

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(audit.router)
api_router.include_router(courses.router)
