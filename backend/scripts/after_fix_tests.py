"""
AFTER tests for all 4 priorities.
Run this AFTER applying 05b_nuclear_rls_fix.sql in the Supabase SQL Editor.
"""
import sys, os
# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client
ANON_KEY = settings.SUPABASE_ANON_KEY
URL = settings.SUPABASE_URL

print("=" * 80)
print("AFTER-FIX LIVE TESTS")
print("=" * 80)

# Setup: use an existing pre-seeded student row
test_matric = "SE24-STUDENT01"
test_email = "se24-student01@student.utm.my"
test_password = "AfterFixTest123!"

# Cleanup any prior auth user
for u in admin.auth.admin.list_users():
    if u.email == test_email:
        admin.table("students").update({"user_id": None}).eq("matric_no", test_matric).execute()
        admin.auth.admin.delete_user(u.id)
        print(f"Cleaned up prior user: {u.id}")

# Verify user_id column exists
import urllib.request, json
req = urllib.request.Request(f"{URL}/rest/v1/", headers={
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
})
with urllib.request.urlopen(req) as resp:
    spec = json.loads(resp.read().decode())
    students_cols = list(spec.get("definitions", {}).get("students", {}).get("properties", {}).keys())
    has_user_id = "user_id" in students_cols
    print(f"\n[SCHEMA CHECK] students columns: {students_cols}")
    print(f"[SCHEMA CHECK] user_id column present: {has_user_id}")
    if not has_user_id:
        print("!! MIGRATION NOT YET APPLIED. Run 05_student_auth_rls.sql first.")
        sys.exit(1)

# Create auth user
print(f"\n[SETUP] Creating auth user for matric {test_matric} ({test_email})")
u1 = admin.auth.admin.create_user({
    "email": test_email,
    "password": test_password,
    "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": test_matric}
})
print(f"  Created: id={u1.user.id}")

# Claim the pre-seeded row
print(f"[SETUP] Setting user_id={u1.user.id} on students row '{test_matric}'")
claim_res = admin.table("students").update({"user_id": u1.user.id}).eq("matric_no", test_matric).execute()
print(f"  Claim OK, updated rows: {len(claim_res.data or [])}")

# Seed academic record
print(f"[SETUP] Seeding academic_records for {test_matric}")
try:
    admin.table("academic_records").delete().eq("matric_no", test_matric).execute()
    admin.table("academic_records").insert({
        "matric_no": test_matric,
        "course_code": "SECJ1013",
        "course_name": "Programming Technique I",
        "semester": "Sem 1 2024/2025",
        "credits": 3,
        "grade": "A",
        "grade_point": 4.0,
        "status": "Pass",
        "prerequisite_met": True
    }).execute()
    print("  Seeded OK")
except Exception as e:
    print(f"  Seed error (may be pre-existing data): {e}")

# Login as student
client = create_client(URL, ANON_KEY)
login = client.auth.sign_in_with_password({"email": test_email, "password": test_password})
print(f"\n[AUTH] Logged in as: auth.uid()={login.user.id}")

# ============================================================
print("\n" + "=" * 60)
print("PRIORITY 1 AFTER: students SELECT")
print("BEFORE: 21 rows | EXPECTED AFTER: exactly 1 row")
print("=" * 60)

p1_res = client.table("students").select("*").execute()
print(f"Raw total rows returned: {len(p1_res.data or [])}")
print("Raw data:")
for r in (p1_res.data or []):
    print(f"  {r}")
if len(p1_res.data or []) == 1 and (p1_res.data or [{}])[0].get("matric_no") == test_matric:
    print("PASS: Exactly 1 row returned, is own matric_no")
elif len(p1_res.data or []) == 0:
    print("PARTIAL: 0 rows - check if user_id was set correctly on the row")
else:
    print(f"FAIL: {len(p1_res.data or [])} rows returned - RLS leak still present")

# ============================================================
print("\n" + "=" * 60)
print("PRIORITY 3 AFTER: academic_records SELECT (pure RLS, no client filter)")
print("BEFORE: 0 rows (advisor-only policy) | EXPECTED AFTER: 1 own row")
print("=" * 60)

p3_all = client.table("academic_records").select("*").execute()
print(f"P3a. Without filter (pure RLS): {len(p3_all.data or [])} rows returned")
print("Raw data:")
for r in (p3_all.data or []):
    print(f"  {r}")

p3_other = client.table("academic_records").select("*").eq("matric_no", "SE24-STUDENT02").execute()
print(f"\nP3b. Filtering OTHER student matric (SE24-STUDENT02): {len(p3_other.data or [])} rows returned")
if len(p3_other.data or []) == 0:
    print("PASS: Cross-student read blocked by RLS")
else:
    print("FAIL: Cross-student read still possible!")
    for r in (p3_other.data or []):
        print(f"  LEAKED: {r}")

if len(p3_all.data or []) == 1:
    print("PASS: P3a returns exactly 1 own academic record via RLS")
elif len(p3_all.data or []) == 0:
    print("PARTIAL: P3a returns 0 rows - check policy or seed data")

# ============================================================
print("\n" + "=" * 60)
print("PRIORITY 2 AFTER: StudentPortal query (academic_records with matric filter)")
print("BEFORE: errors (results table not found) | EXPECTED AFTER: returns rows")
print("=" * 60)

p2_res = client.table("academic_records").select("*").eq("matric_no", test_matric).order("semester", desc=False).execute()
print(f"Raw rows returned: {len(p2_res.data or [])}")
print("Raw data:")
for r in (p2_res.data or []):
    print(f"  {r}")
if len(p2_res.data or []) > 0:
    print("PASS: academic_records returns data via portal-style query")
else:
    print("PARTIAL: 0 rows - check academic_records RLS or seed data")

# ============================================================
print("\n" + "=" * 60)
print("PRIORITY 4 AFTER: Ghost matric lookup (claim flow)")
print("EXPECTED: lookup returns None for unknown matric -> signUpStudent rejects")
print("=" * 60)

ghost_matric = "A24EC9999"
ghost_email = "a24ec9999@student.utm.my"

for u in admin.auth.admin.list_users():
    if u.email == ghost_email:
        admin.auth.admin.delete_user(u.id)

ghost_u = admin.auth.admin.create_user({
    "email": ghost_email, "password": "TestPass123!", "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": ghost_matric}
})
ghost_client = create_client(URL, ANON_KEY)
ghost_client.auth.sign_in_with_password({"email": ghost_email, "password": "TestPass123!"})

ghost_lookup_res = ghost_client.table("students").select("matric_no, user_id").eq("matric_no", ghost_matric).execute()
ghost_found = ghost_lookup_res.data  # empty list = not found, non-empty = found

print(f"Lookup result for ghost matric '{ghost_matric}': {ghost_found}")

if not ghost_found:
    print("PASS: No pre-seeded row found -> signUpStudent returns error:")
    print(f'  "Matric number \"{ghost_matric}\" not found in the system. Please contact your advisor..."')
else:
    print(f"FAIL: Row found unexpectedly: {ghost_found}")

# Also test: Can ghost student see other students via RLS?
ghost_st = ghost_client.table("students").select("matric_no").execute()
print(f"\nGhost student (no claimed row) querying students: {len(ghost_st.data or [])} rows")
if len(ghost_st.data or []) == 0:
    print("PASS: Ghost student with no claimed row sees 0 rows")
else:
    print(f"FAIL: Ghost student sees {len(ghost_st.data or [])} rows!")
    for r in (ghost_st.data or []):
        print(f"  LEAKED: {r.get('matric_no')}")

admin.auth.admin.delete_user(ghost_u.user.id)

# Cleanup main test
admin.table("academic_records").delete().eq("matric_no", test_matric).execute()
admin.table("students").update({"user_id": None}).eq("matric_no", test_matric).execute()
admin.auth.admin.delete_user(u1.user.id)
print("\n[CLEANUP] Done.")
