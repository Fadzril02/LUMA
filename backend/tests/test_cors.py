"""
CORS configuration tests.

Verifies:
1. An allowed origin receives Access-Control-Allow-Origin in the response.
2. A random / unknown origin does NOT receive Access-Control-Allow-Origin.
3. When BACKEND_CORS_ORIGIN_REGEX is set, a matching origin is accepted.
"""
import pytest
from fastapi.testclient import TestClient

try:
    from app.main import app
    import app.core.config as cfg_module
except ImportError:
    from backend.app.main import app
    import backend.app.core.config as cfg_module


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=False)


def _options(client, origin: str) -> dict:
    """Send a CORS pre-flight and return response headers (lower-cased keys)."""
    res = client.options(
        "/",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    return {k.lower(): v for k, v in res.headers.items()}


def test_allowed_origin_gets_acao_header(client):
    """A configured explicit origin must appear in the ACAO response header."""
    headers = _options(client, "http://localhost:5173")
    assert headers.get("access-control-allow-origin") == "http://localhost:5173", (
        f"Expected ACAO=http://localhost:5173, got: {headers}"
    )


def test_random_origin_does_not_get_acao_header(client):
    """An unconfigured origin must NOT receive an ACAO header (or get a null/empty value)."""
    headers = _options(client, "https://evil.example.com")
    acao = headers.get("access-control-allow-origin", "")
    assert acao not in ("https://evil.example.com", "*"), (
        f"ACAO should be absent or null for unknown origin, got: {acao!r}"
    )


def test_regex_origin_accepted_when_regex_configured():
    """
    When BACKEND_CORS_ORIGIN_REGEX is set, a matching preview URL must be allowed.
    Builds a minimal app with the regex wired in directly.
    """
    staging_url = "https://syngrad-git-dev-abc123.vercel.app"
    regex_pattern = r"^https://syngrad-git-dev-[a-z0-9-]+\.vercel\.app$"

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o).rstrip("/") for o in cfg_module.settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_origin_regex=regex_pattern,
    )

    @test_app.get("/")
    def _root():
        return {}

    c = TestClient(test_app, raise_server_exceptions=False)
    res = c.options(
        "/",
        headers={
            "Origin": staging_url,
            "Access-Control-Request-Method": "GET",
        },
    )
    acao = res.headers.get("access-control-allow-origin", "")
    assert acao == staging_url, (
        f"Regex-matching staging URL should be allowed, got ACAO={acao!r}"
    )
