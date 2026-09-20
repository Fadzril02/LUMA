"""
JWT / Identity Gate — Local Live Verification Script
Runs against the local FastAPI application directly (in-memory TestClient).
Tests:
  T1: No Authorization header       → expect 401 (or 422 if missing header)
  T2: Fake/garbage JWT               → expect 401
  T3: Real JWT (Liyana), wrong advisor_id → expect 403
  T4: Real JWT (Liyana), correct advisor_id → expect 200
"""

import os
import sys
import json
import requests

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend path is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

SUPABASE_URL = settings.SUPABASE_URL
ANON_KEY = settings.SUPABASE_ANON_KEY
SERVICE_ROLE_KEY = settings.SUPABASE_SERVICE_ROLE_KEY

LIYANA_EMAIL = "liyana@utm.my"
LIYANA_PASSWORD = "LiyanaAdvisor2026!"
LIYANA_STAFF_ID = "STAFF-LIYANA"

def make_payload(advisor_id="STAFF-LIYANA"):
    return {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "A24CS0001",
        "student_name": "JWT Auth Test Student",
        "academic_session": "2024/2025",
        "semester": 1,
        "program_code": "SECJ",
        "curriculum_year": "2024/2025",
        "advisor_id": advisor_id,
        "courses": [
            {
                "course_code": "SECJ1013",
                "course_name": "Programming Technique I",
                "grade": "A",
                "credit_hour": 3,
                "credits": 3,
                "status": "Pass",
                "session_semester": "2024/2025-1"
            }
        ]
    }

divider = "=" * 80

print(divider)
print("OBTAINING REAL SUPABASE JWT FOR LIYANA")
print(divider)

login_resp = requests.post(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    json={"email": LIYANA_EMAIL, "password": LIYANA_PASSWORD},
    timeout=15,
)

if login_resp.status_code != 200:
    print(f"FATAL: Could not log in as {LIYANA_EMAIL}: {login_resp.status_code}")
    sys.exit(1)

liyana_token = login_resp.json()["access_token"]
print(f"Successfully obtained live JWT for {LIYANA_EMAIL}")
print(f"Token prefix: {liyana_token[:40]}...")
print()

# T1: No Auth Header
print(divider)
print("T1: POST /api/v1/audit/finalize-approval with NO Authorization header")
print("    Expected: 401 or 422")
print(divider)
r1 = client.post("/api/v1/audit/finalize-approval", json=make_payload())
print(f"  HTTP Status: {r1.status_code}")
print(f"  Response Body: {r1.text}")
print(f"  RESULT: {'PASS ✓' if r1.status_code in (401, 422) else 'FAIL ✗'}")
print()

# T2: Fake/Garbage JWT
print(divider)
print("T2: POST /api/v1/audit/finalize-approval with fake/garbage JWT")
print("    Expected: 401")
print(divider)
garbage_token = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsImVtYWlsIjoiZXZpbEBoYWNrZXIuY29tIn0.AAAA_fake_sig_garbage"
r2 = client.post(
    "/api/v1/audit/finalize-approval",
    json=make_payload(),
    headers={"Authorization": f"Bearer {garbage_token}"}
)
print(f"  HTTP Status: {r2.status_code}")
print(f"  Response Body: {r2.text}")
print(f"  RESULT: {'PASS ✓' if r2.status_code == 401 else 'FAIL ✗'}")
print()

# T3: Real JWT + Wrong advisor_id
print(divider)
print("T3: POST /api/v1/audit/finalize-approval with REAL JWT + WRONG advisor_id")
print(f"    JWT belongs to: {LIYANA_EMAIL} ({LIYANA_STAFF_ID})")
print(f"    Body claims:     advisor_id='STAFF-IMPERSONATION-TARGET'")
print("    Expected: 403")
print(divider)
r3 = client.post(
    "/api/v1/audit/finalize-approval",
    json=make_payload(advisor_id="STAFF-IMPERSONATION-TARGET"),
    headers={"Authorization": f"Bearer {liyana_token}"}
)
print(f"  HTTP Status: {r3.status_code}")
print(f"  Response Body: {r3.text}")
print(f"  RESULT: {'PASS ✓' if r3.status_code == 403 else 'FAIL ✗'}")
print()

# T4: Real JWT + Matching advisor_id
print(divider)
print("T4: POST /api/v1/audit/finalize-approval with REAL JWT + MATCHING advisor_id")
print(f"    JWT belongs to: {LIYANA_EMAIL} ({LIYANA_STAFF_ID})")
print(f"    Body claims:     advisor_id='{LIYANA_STAFF_ID}'")
print("    Expected: 200")
print(divider)
r4 = client.post(
    "/api/v1/audit/finalize-approval",
    json=make_payload(advisor_id=LIYANA_STAFF_ID),
    headers={"Authorization": f"Bearer {liyana_token}"}
)
print(f"  HTTP Status: {r4.status_code}")
print(f"  Response Body: {r4.text[:300]}...")
print(f"  RESULT: {'PASS ✓' if r4.status_code == 200 else 'FAIL ✗'}")
print()

# SUMMARY
print(divider)
print("SUMMARY")
print(divider)
print(f"  T1 (No Auth Header):        HTTP {r1.status_code} ({'PASS' if r1.status_code in (401, 422) else 'FAIL'})")
print(f"  T2 (Garbage JWT):           HTTP {r2.status_code} ({'PASS' if r2.status_code == 401 else 'FAIL'})")
print(f"  T3 (Real JWT, Wrong ID):    HTTP {r3.status_code} ({'PASS' if r3.status_code == 403 else 'FAIL'})")
print(f"  T4 (Real JWT, Correct ID):  HTTP {r4.status_code} ({'PASS' if r4.status_code == 200 else 'FAIL'})")
print(divider)
