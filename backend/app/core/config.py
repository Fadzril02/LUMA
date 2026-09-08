"""
Smart Academic Assessment System - Centralized Configuration Module
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    # Global Identity & Metadata
    PROJECT_NAME: str = "Smart-AA-System"
    COMPANY_NAME: str = "Academic Advising"
    PROJECT_DOMAIN: str = "localhost"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    PORT: int = 8000

    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Micro-LLM Fallback (Groq / OpenRouter / OpenAI SDK compatible)
    GROQ_API_KEY: Optional[str] = ""
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "llama-3.1-8b-instant"

    # Frontend URL & CORS
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "https://*.pages.dev",
        "https://*.netlify.app",
        "https://*.vercel.app",
    ]

    @model_validator(mode="after")
    def populate_fallback_keys(self) -> "Settings":
        if not self.LLM_API_KEY and self.GROQ_API_KEY:
            self.LLM_API_KEY = self.GROQ_API_KEY
        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
