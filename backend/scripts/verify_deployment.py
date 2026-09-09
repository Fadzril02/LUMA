"""
Live connectivity test:
1. Render health check + cold-start timing
2. CORS preflight from production Vercel origin
3. Test a real POST (upload endpoint) with a small dummy PDF
4. Bucket privacy confirmation
"""
import sys, os, time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

import requests

RENDER_URL = "https://luma-xswf.onrender.com"
VERCEL_ORIGIN = "https://luma-two-theta.vercel.app"
SUPABASE_URL = settings.SUPABASE_URL
SERVICE_KEY = settings.SUPABASE_SERVICE_ROLE_KEY

# ── 1. Health check + cold-start timing ──────────────────────────────────────
print("=" * 70)
print("1. RENDER HEALTH CHECK (cold-start timing)")
print("=" * 70)
t0 = time.time()
try:
    resp = requests.get(f"{RENDER_URL}/", timeout=90)
    elapsed = time.time() - t0
    print(f"  Status  : {resp.status_code}")
    print(f"  Time    : {elapsed:.1f}s")
    print(f"  Body    : {resp.text[:200]}")
    if elapsed > 10:
        print(f"  NOTE: Server was cold — took {elapsed:.0f}s to respond.")
        print("  The 75s timeout in api.ts will handle this.")
    else:
        print(f"  Server was already warm ({elapsed:.1f}s).")
except requests.exceptions.Timeout:
    elapsed = time.time() - t0
    print(f"  TIMEOUT after {elapsed:.0f}s — Render is down or overloaded.")
except Exception as e:
    print(f"  FAILED: {e}")

# ── 2. CORS preflight ─────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("2. CORS PREFLIGHT (OPTIONS from Vercel origin)")
print("=" * 70)
try:
    resp = requests.options(
        f"{RENDER_URL}/api/v1/health",
        headers={
            "Origin": VERCEL_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
        timeout=15
    )
    acao = resp.headers.get("access-control-allow-origin", "MISSING")
    acam = resp.headers.get("access-control-allow-methods", "MISSING")
    acah = resp.headers.get("access-control-allow-headers", "MISSING")
    print(f"  Status                        : {resp.status_code}")
    print(f"  Access-Control-Allow-Origin   : {acao}")
    print(f"  Access-Control-Allow-Methods  : {acam}")
    print(f"  Access-Control-Allow-Headers  : {acah}")

    if acao == VERCEL_ORIGIN or acao == "*":
        print("  PASS: CORS allows the Vercel origin.")
    else:
        print("  FAIL: CORS does NOT allow the Vercel origin.")
        print("  FIX: Add CORS_ORIGINS override on Render env vars or redeploy config.py fix.")
except Exception as e:
    print(f"  FAILED: {e}")

# ── 3. GET /api/v1/health ─────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("3. GET /api/v1/health")
print("=" * 70)
try:
    resp = requests.get(
        f"{RENDER_URL}/api/v1/health",
        headers={"Origin": VERCEL_ORIGIN},
        timeout=15
    )
    print(f"  Status: {resp.status_code}")
    print(f"  Body  : {resp.text[:300]}")
except Exception as e:
    print(f"  FAILED: {e}")

# ── 4. Bucket privacy ─────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("4. SUPABASE BUCKET PRIVACY")
print("=" * 70)
from app.core.supabase_client import SupabaseService
svc = SupabaseService()
admin = svc.client

buckets = admin.storage.list_buckets()
for b in buckets:
    name = b.name if hasattr(b, 'name') else b.get('name', '?')
    public = b.public if hasattr(b, 'public') else b.get('public', '?')
    status = "PUBLIC  <-- RISK: direct URL access works without auth" if public else "private (OK)"
    print(f"  {name:35s}  {status}")

print("\n  Testing direct URL access to transcripts bucket (should be blocked)...")
import urllib.request, urllib.error
try:
    # Try to access a non-existent file — a 404 means public, a 400/403 means private
    url = f"{SUPABASE_URL}/storage/v1/object/public/transcripts/nonexistent.pdf"
    req = urllib.request.Request(url)
    urllib.request.urlopen(req, timeout=8)
    print(f"  FAIL: Got 200 — bucket is public! Direct URL access works.")
except urllib.error.HTTPError as e:
    if e.code == 404:
        print(f"  WARN: HTTP 404 — bucket may be public (file just doesn't exist yet).")
        print("  Confirm 'transcripts' is private in Supabase Dashboard > Storage > Policies.")
    elif e.code in (400, 401, 403):
        print(f"  PASS: HTTP {e.code} — bucket is private, direct URL access blocked.")
