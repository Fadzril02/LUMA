import os
import sys
import json
import requests

sys.path.insert(0, os.path.abspath("backend"))
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client
url = settings.SUPABASE_URL
anon_key = settings.SUPABASE_ANON_KEY
service_key = settings.SUPABASE_SERVICE_ROLE_KEY

print("=" * 80)
print("SECTION 2: AUTHENTICATION & RLS ISOLATION AUDIT (2 STUDENTS + 2 ADVISORS)")
print("=" * 80)

# Setup test identities
s1_matric = "A24TEST01"
s1_email = "audit_student1@student.utm.my"
s1_pass = "AuditStudentPass123!"

s2_matric = "A24TEST02"
s2_email = "audit_student2@student.utm.my"
s2_pass = "AuditStudentPass123!"

a1_staff = "STAFF-AUDIT01"
a1_email = "audit_advisor1@utm.my"
a1_pass = "AuditAdvisorPass123!"

a2_staff = "STAFF-AUDIT02"
a2_email = "audit_advisor2@utm.my"
a2_pass = "AuditAdvisorPass123!"

# 1. Clean up any previous test auth users if they exist
existing_users = admin.auth.admin.list_users()
test_emails = {s1_email, s2_email, a1_email, a2_email}
for u in existing_users:
    if u.email in test_emails:
        print(f"Cleaning up prior test user: {u.email} ({u.id})")
        admin.auth.admin.delete_user(u.id)

# 2. Create Auth Users via Supabase Auth Admin API
u_s1 = admin.auth.admin.create_user({
    "email": s1_email, "password": s1_pass, "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": s1_matric, "full_name": "Audit Student 1"}
})
s1_uid = u_s1.user.id

u_s2 = admin.auth.admin.create_user({
    "email": s2_email, "password": s2_pass, "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": s2_matric, "full_name": "Audit Student 2"}
})
s2_uid = u_s2.user.id

u_a1 = admin.auth.admin.create_user({
    "email": a1_email, "password": a1_pass, "email_confirm": True,
    "user_metadata": {"role": "advisor", "staff_id": a1_staff, "full_name": "Audit Advisor 1"}
})
a1_uid = u_a1.user.id

u_a2 = admin.auth.admin.create_user({
    "email": a2_email, "password": a2_pass, "email_confirm": True,
    "user_metadata": {"role": "advisor", "staff_id": a2_staff, "full_name": "Audit Advisor 2"}
})
a2_uid = u_a2.user.id

print(f"Created Auth User S1: {s1_email} -> UID {s1_uid}")
print(f"Created Auth User S2: {s2_email} -> UID {s2_uid}")
print(f"Created Auth User A1: {a1_email} -> UID {a1_uid}")
print(f"Created Auth User A2: {a2_email} -> UID {a2_uid}")

# 3. Seed student rows and advisor rows with user_id & email
# Because students and academic_records have FORCE ROW LEVEL SECURITY enabled,
# we insert using service_role or RPC or direct PostgREST.
# Let's test if service_role can insert with bypass or service role headers:
headers_srv = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Clean existing test rows
requests.delete(f"{url}/rest/v1/academic_records?matric_no=in.({s1_matric},{s2_matric})", headers=headers_srv)
requests.delete(f"{url}/rest/v1/students?matric_no=in.({s1_matric},{s2_matric})", headers=headers_srv)
requests.delete(f"{url}/rest/v1/advisors?staff_id=in.({a1_staff},{a2_staff})", headers=headers_srv)

# Insert students
r_s1 = requests.post(f"{url}/rest/v1/students", headers=headers_srv, json={
    "matric_no": s1_matric,
    "name": "Audit Student 1",
    "program": "SECJ",
    "syllabus_type": "2023/2024",
    "advisor_staff_id": a1_staff,
    "institutional_email": s1_email,
    "user_id": s1_uid
})
print(f"Seed student 1 ({s1_matric}) -> Status {r_s1.status_code}: {r_s1.text}")

r_s2 = requests.post(f"{url}/rest/v1/students", headers=headers_srv, json={
    "matric_no": s2_matric,
    "name": "Audit Student 2",
    "program": "SECJ",
    "syllabus_type": "2023/2024",
    "advisor_staff_id": a2_staff,
    "institutional_email": s2_email,
    "user_id": s2_uid
})
print(f"Seed student 2 ({s2_matric}) -> Status {r_s2.status_code}: {r_s2.text}")

# Insert academic records for S1 and S2
r_ar1 = requests.post(f"{url}/rest/v1/academic_records", headers=headers_srv, json={
    "matric_no": s1_matric,
    "course_code": "SE101",
    "course_name": "Software Engineering 1",
    "credits": 3,
    "grade": "A",
    "grade_point": 4.0,
    "semester": "2024/2025-1",
    "status": "COMPLETED",
    "prerequisite_met": True,
    "missing_prerequisites": [],
    "is_ai_parsed": False
})
print(f"Seed academic record S1 -> Status {r_ar1.status_code}: {r_ar1.text}")

r_ar2 = requests.post(f"{url}/rest/v1/academic_records", headers=headers_srv, json={
    "matric_no": s2_matric,
    "course_code": "SE102",
    "course_name": "Software Engineering 2",
    "credits": 3,
    "grade": "B",
    "grade_point": 3.0,
    "semester": "2024/2025-1",
    "status": "COMPLETED",
    "prerequisite_met": True,
    "missing_prerequisites": [],
    "is_ai_parsed": False
})
print(f"Seed academic record S2 -> Status {r_ar2.status_code}: {r_ar2.text}")

# Insert advisors
r_a1 = requests.post(f"{url}/rest/v1/advisors", headers=headers_srv, json={
    "staff_id": a1_staff,
    "name": "Audit Advisor 1",
    "department": "Software Engineering",
    "institutional_email": a1_email,
    "user_id": a1_uid
})
print(f"Seed advisor 1 ({a1_staff}) -> Status {r_a1.status_code}: {r_a1.text}")

r_a2 = requests.post(f"{url}/rest/v1/advisors", headers=headers_srv, json={
    "staff_id": a2_staff,
    "name": "Audit Advisor 2",
    "department": "Artificial Intelligence",
    "institutional_email": a2_email,
    "user_id": a2_uid
})
print(f"Seed advisor 2 ({a2_staff}) -> Status {r_a2.status_code}: {r_a2.text}")

# 4. Sign in as each user using Supabase Auth to get real JWT access tokens
def get_user_token(email, password):
    resp = requests.post(
        f"{url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json={"email": email, "password": password}
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    raise Exception(f"Failed auth for {email}: {resp.status_code} {resp.text}")

token_s1 = get_user_token(s1_email, s1_pass)
token_s2 = get_user_token(s2_email, s2_pass)
token_a1 = get_user_token(a1_email, a1_pass)
token_a2 = get_user_token(a2_email, a2_pass)

def test_user_queries(user_label, token):
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    print("\n" + "-" * 70)
    print(f"RUNNING QUERIES AS: {user_label}")
    print("-" * 70)
    for tbl in ["students", "academic_records", "advisors"]:
        resp = requests.get(f"{url}/rest/v1/{tbl}?select=*", headers=headers)
        rows = resp.json() if resp.status_code == 200 else []
        print(f"[{user_label}] SELECT from '{tbl}': HTTP {resp.status_code} | Rows returned: {len(rows)}")
        for idx, row in enumerate(rows, 1):
            summary = {k: row[k] for k in ["matric_no", "name", "staff_id", "course_code", "institutional_email", "user_id"] if k in row}
            print(f"   Row {idx}: {summary}")

test_user_queries("STUDENT 1 (A24TEST01)", token_s1)
test_user_queries("STUDENT 2 (A24TEST02)", token_s2)
test_user_queries("ADVISOR 1 (STAFF-AUDIT01)", token_a1)
test_user_queries("ADVISOR 2 (STAFF-AUDIT02)", token_a2)
