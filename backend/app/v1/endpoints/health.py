import base64
import json
from fastapi import APIRouter
try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health check")
async def health_check():
    sr_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    anon_key = settings.SUPABASE_ANON_KEY or ""
    
    sr_role = "EMPTY"
    if sr_key and "." in sr_key:
        try:
            parts = sr_key.split(".")
            if len(parts) >= 2:
                payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
                sr_role = payload.get("role", "NO_ROLE_FIELD")
        except Exception as e:
            sr_role = f"MALFORMED_JWT ({e})"

    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "company": settings.COMPANY_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
        "diagnostics": {
            "supabase_url": settings.SUPABASE_URL,
            "has_service_role_key": bool(sr_key),
            "service_role_key_len": len(sr_key),
            "service_role_key_prefix": sr_key[:15] + "..." if sr_key else "EMPTY",
            "service_role_key_suffix": "..." + sr_key[-8:] if sr_key else "EMPTY",
            "service_role_jwt_role": sr_role,
            "has_anon_key": bool(anon_key),
            "anon_key_len": len(anon_key),
            "anon_key_prefix": anon_key[:15] + "..." if anon_key else "EMPTY",
            "is_service_role_same_as_anon": bool(sr_key and sr_key == anon_key)
        }
    }
