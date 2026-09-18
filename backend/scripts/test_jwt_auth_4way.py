"""
JWT / Identity Gate — 4-Way Live Verification Script
Runs against the LIVE deployed backend (Render).

Test Matrix:
  T1: No Authorization header       → expect 401 (was 200 before fix)
  T2: Fake/garbage JWT               → expect 401 (was 200 before fix)
  T3: Real JWT (Liyana), body claims DIFFERENT advisor_id → expect 403
  T4: Real JWT (Liyana), body claims MATCHING advisor_id  → expect 200
"""

import os, sys, json, requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

# ─── Configuration ───────────────────────────────────────────────────────────
RENDER_URL = "https://luma-xswf.onrender.com"
ENDPOINT = f"{RENDER_URL}/api/v1/audit/finalize-approval"
SUPABASE_URL = settings.SUPABASE_URL
ANON_KEY = settings.SUPABASE_ANON_KEY

# Liyana (primary advisor)
LIYANA_EMAIL = "liyana@utm.my"
LIYANA_PASSWORD = "LiyanaAdvisor2026!"
LIYANA_STAFF_ID = "STAFF-LIYANA"

# Minimal valid-shape payload (will fail business logic but tests the auth gate)
def make_payload(advisor_id="STAFF-LIYANA"):
    return {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "A24CS0001",
        "student_name": "JWT Auth Test Student",
        "academic_session": "2024/2025",
        "semester": 1,
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


# ─── Step 0: Reset Liyana's password & obtain a real JWT ─────────────────────
print(divider)
print("STEP 0: Resetting Liyana password via Admin API, then authenticating")
print(divider)

SERVICE_ROLE_KEY = settings.SUPABASE_SERVICE_ROLE_KEY

# 0a. Find Liyana's auth UID via admin list_users
admin_headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

list_users_resp = requests.get(
    f"{SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200",
    headers=admin_headers,
    timeout=15,
)
if list_users_resp.status_code != 200:
    print(f"FATAL: Could not list users: {list_users_resp.status_code}")
    print(list_users_resp.text)
    sys.exit(1)

users_data = list_users_resp.json()
# Handle both { "users": [...] } and direct [...] envelope shapes
user_list = users_data.get("users", users_data) if isinstance(users_data, dict) else users_data
liyana_uid = None
for u in user_list:
    if u.get("email") == LIYANA_EMAIL:
        liyana_uid = u["id"]
        break

if not liyana_uid:
    print(f"  Liyana not found in auth — creating now...")
    create_resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=admin_headers,
        json={
            "email": LIYANA_EMAIL,
            "password": LIYANA_PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "role": "advisor",
                "staff_id": LIYANA_STAFF_ID,
                "full_name": "Madam Liyana",
            },
        },
        timeout=15,
    )
    if create_resp.status_code not in (200, 201):
        print(f"FATAL: Could not create user: {create_resp.status_code} {create_resp.text}")
        sys.exit(1)
    liyana_uid = create_resp.json()["id"]
    print(f"  Created Liyana UID: {liyana_uid}")

    # Also upsert the advisors table row
    upsert_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/advisors",
        headers={
            **admin_headers,
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
        json={
            "staff_id": LIYANA_STAFF_ID,
            "name": "Madam Liyana",
            "department": "Software Engineering",
            "institutional_email": LIYANA_EMAIL,
            "user_id": liyana_uid,
        },
        timeout=15,
    )
    print(f"  Advisor row upsert: {upsert_resp.status_code}")
else:
    print(f"  Found Liyana UID: {liyana_uid}")

# 0b. Reset password via admin API
reset_resp = requests.put(
    f"{SUPABASE_URL}/auth/v1/admin/users/{liyana_uid}",
    headers=admin_headers,
    json={"password": LIYANA_PASSWORD, "email_confirm": True},
    timeout=15,
)
print(f"  Password reset status: {reset_resp.status_code}")

# 0c. Login
login_resp = requests.post(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    json={"email": LIYANA_EMAIL, "password": LIYANA_PASSWORD},
    timeout=15,
)

if login_resp.status_code != 200:
    print(f"FATAL: Could not log in as {LIYANA_EMAIL}")
    print(f"Status: {login_resp.status_code}")
    print(f"Body: {login_resp.text}")
    sys.exit(1)

liyana_token = login_resp.json()["access_token"]
print(f"✓ Obtained JWT for {LIYANA_EMAIL}")
print(f"  Token prefix: {liyana_token[:40]}...")
print()

# ─── Wake up the Render backend (free tier cold start) ──────────────────────
print(divider)
print("WARMUP: Sending GET / to wake up the Render backend (may take 60-90s)...")
print(divider)
try:
    warmup = requests.get(f"{RENDER_URL}/", timeout=120)
    print(f"  Warmup status: {warmup.status_code} (backend is awake)")
except Exception as we:
    print(f"  Warmup result: {we}")
    print("  Continuing anyway — backend may still be booting")
print()

# ─── T1: No Authorization header → 401 ──────────────────────────────────────
print(divider)
print("T1: POST /finalize-approval with NO Authorization header")
print(f"    Expected: 401")
print(divider)

r1 = requests.post(ENDPOINT, json=make_payload(), timeout=120)
print(f"  HTTP Status: {r1.status_code}")
print(f"  Response Body: {r1.text}")
t1_pass = r1.status_code == 401 or r1.status_code == 422  # 422 from FastAPI if header missing
# FastAPI's Header(...) with no default may return 422 for missing header
print(f"  RESULT: {'PASS ✓' if r1.status_code in (401, 422) else 'FAIL ✗ — CRITICAL VULNERABILITY'}")
print()

# ─── T2: Garbage JWT → 401 ──────────────────────────────────────────────────
print(divider)
print("T2: POST /finalize-approval with fake/garbage JWT")
print(f"    Expected: 401")
print(divider)

garbage_token = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsImVtYWlsIjoiZXZpbEBoYWNrZXIuY29tIn0.AAAA_fake_sig_garbage"
r2 = requests.post(
    ENDPOINT,
    json=make_payload(),
    headers={"Authorization": f"Bearer {garbage_token}"},
    timeout=120,
)
print(f"  HTTP Status: {r2.status_code}")
print(f"  Response Body: {r2.text}")
print(f"  RESULT: {'PASS ✓' if r2.status_code == 401 else 'FAIL ✗ — CRITICAL VULNERABILITY'}")
print()

# ─── T3: Real JWT (Liyana), but advisor_id=DIFFERENT → 403 ──────────────────
print(divider)
print("T3: POST /finalize-approval with REAL JWT (Liyana) + WRONG advisor_id")
print(f"    JWT belongs to: {LIYANA_EMAIL} (STAFF-LIYANA)")
print(f"    Body claims:     advisor_id='STAFF-IMPERSONATION-TARGET'")
print(f"    Expected: 403")
print(divider)

r3 = requests.post(
    ENDPOINT,
    json=make_payload(advisor_id="STAFF-IMPERSONATION-TARGET"),
    headers={"Authorization": f"Bearer {liyana_token}"},
    timeout=120,
)
print(f"  HTTP Status: {r3.status_code}")
print(f"  Response Body: {r3.text}")
print(f"  RESULT: {'PASS ✓' if r3.status_code == 403 else 'FAIL ✗ — IDENTITY CROSS-CHECK BROKEN'}")
print()

# ─── T4: Real JWT (Liyana) + MATCHING advisor_id → 200 ──────────────────────
print(divider)
print("T4: POST /finalize-approval with REAL JWT (Liyana) + CORRECT advisor_id")
print(f"    JWT belongs to: {LIYANA_EMAIL} (STAFF-LIYANA)")
print(f"    Body claims:     advisor_id='STAFF-LIYANA'")
print(f"    Expected: 200 (legitimate path)")
print(divider)

r4 = requests.post(
    ENDPOINT,
    json=make_payload(advisor_id="STAFF-LIYANA"),
    headers={"Authorization": f"Bearer {liyana_token}"},
    timeout=120,
)
print(f"  HTTP Status: {r4.status_code}")
# Pretty-print the JSON body
try:
    body4 = json.dumps(r4.json(), indent=2, ensure_ascii=False)
except Exception:
    body4 = r4.text
print(f"  Response Body:\n{body4}")
print(f"  RESULT: {'PASS ✓' if r4.status_code == 200 else 'FAIL ✗ — LEGITIMATE PATH BROKEN'}")
print()

# ─── Summary ─────────────────────────────────────────────────────────────────
print(divider)
print("SUMMARY")
print(divider)
results = {
    "T1 (No Auth Header)":        r1.status_code,
    "T2 (Garbage JWT)":           r2.status_code,
    "T3 (Real JWT, Wrong ID)":    r3.status_code,
    "T4 (Real JWT, Correct ID)":  r4.status_code,
}
for label, code in results.items():
    print(f"  {label}: HTTP {code}")
print(divider)
