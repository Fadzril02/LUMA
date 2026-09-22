"""
Smart Academic Assessment System - FastAPI Application Entrypoint
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from app.core.config import settings
    from app.v1.router import api_router
except ImportError:
    from backend.app.core.config import settings
    from backend.app.v1.router import api_router

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API Engine",
    description=f"Automated Degree Audit & Transcript Parser Engine by {settings.COMPANY_NAME}",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import logging
import sys
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("uvicorn.error")

# Startup validation for critical environment variables
sr_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
anon_key = settings.SUPABASE_ANON_KEY or ""
if not sr_key or sr_key == anon_key:
    logger.critical(
        "[FATAL CONFIGURATION WARNING] SUPABASE_SERVICE_ROLE_KEY is missing or identical to SUPABASE_ANON_KEY. "
        "Mutating operations requiring RLS bypass (audits, curriculum ingestion, storage) will fail loudly with 500/503."
    )
    sys.stderr.write(
        "\n================================================================================\n"
        "[FATAL CONFIGURATION WARNING] SUPABASE_SERVICE_ROLE_KEY IS NOT CONFIGURED PROPERLY!\n"
        f"SUPABASE_SERVICE_ROLE_KEY present: {bool(sr_key)} | Is Anon Key: {bool(sr_key and sr_key == anon_key)}\n"
        "All admin operations requiring RLS bypass will refuse to serve.\n"
        "================================================================================\n\n"
    )
    sys.stderr.flush()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(
        f"[CRITICAL UNHANDLED ERROR] {request.method} {request.url.path} - Exception: {exc.__class__.__name__}: {exc}\n{tb}",
        exc_info=True
    )
    sys.stderr.flush()
    sys.stdout.flush()
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": exc.__class__.__name__,
            "path": request.url.path,
            "traceback": tb
        }
    )

# Mount API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} Engine",
        "company": settings.COMPANY_NAME,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
