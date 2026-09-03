"""
[PROJECT_NAME] Configuration Module
Company: [COMPANY_NAME]
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Global Identity & Metadata
    PROJECT_NAME: str = "LUMA"
    COMPANY_NAME: str = "Novus Mandiri"
    PROJECT_DOMAIN: str = "localhost"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Micro-LLM Fallback (Groq / OpenRouter OpenAI SDK compatible)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "llama-3.1-8b-instant"

    # CORS Settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "https://*.pages.dev",
        "https://*.netlify.app",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
