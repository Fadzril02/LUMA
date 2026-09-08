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
