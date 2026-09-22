"""
Smart Academic Assessment System - FastAPI Application Entrypoint
"""

import os
import sys
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

try:
    from app.core.config import settings
    from app.v1.router import api_router
except ImportError:
    from backend.app.core.config import settings
    from backend.app.v1.router import api_router


def verify_environment() -> None:
    """
    Validate critical environment variables before container initialization.
    Crashes early and loudly if essential database secrets are missing.
    """
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
    if not service_role_key or not str(service_role_key).strip():
        raise RuntimeError(
            "CRITICAL BOOT FAILURE: SUPABASE_SERVICE_ROLE_KEY is missing. Halting startup to prevent silent database auth failures."
        )


# Step 1: Pre-boot environment verification
verify_environment()

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


# Step 2: Sterile Global Exception Handler (Anti-Leak)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logging.error(
        f"Unhandled exception processing {request.method} {request.url.path}: {exc}\n{tb}"
    )
    sys.stderr.flush()
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact support."}
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
