import os
import sys
import requests
import json

sys.path.insert(0, os.path.abspath("backend"))
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client
url = settings.SUPABASE_URL
service_key = settings.SUPABASE_SERVICE_ROLE_KEY

headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def count_table(table_name):
    r = requests.get(
        f"{url}/rest/v1/{table_name}?select=*&limit=1",
        headers={**headers, "Prefer": "count=exact"}
    )
    cr = r.headers.get("content-range")
    if cr and "/" in cr:
        return int(cr.split("/")[1])
    return 0

print("=" * 80)
print("PRE-DELETION TABLE COUNTS")
print("=" * 80)
tables = ["academic_records", "uploaded_documents", "students", "advisors", "system_audit_logs", "course", "course_prerequisite"]
counts_before = {t: count_table(t) for t in tables}
for t, c in counts_before.items():
    print(f"  public.{t}: {c} rows")

users_before = admin.auth.admin.list_users()
print(f"  auth.users: {len(users_before)} users")

test_matrics = ["A24TEST01", "A24TEST02", "A24PURGE01"]
test_staff = ["STAFF-AUDIT01", "STAFF-AUDIT02", "STAFF-PURGE01"]
test_emails = [
    "audit_student1@student.utm.my",
    "audit_student2@student.utm.my",
    "audit_advisor1@utm.my",
    "audit_advisor2@utm.my"
]

print("\n" + "=" * 80)
print("EXECUTING DELETIONS IN FOREIGN KEY ORDER")
print("=" * 80)

# 1. academic_records
matrics_filter = ",".join(test_matrics)
r_ar = requests.delete(f"{url}/rest/v1/academic_records?matric_no=in.({matrics_filter})", headers=headers)
print(f"1. academic_records delete: HTTP {r_ar.status_code} | deleted {len(r_ar.json()) if r_ar.status_code == 200 else r_ar.text}")

# 2. uploaded_documents (check A24TEST01, A24TEST02 first)
r_chk = requests.get(f"{url}/rest/v1/uploaded_documents?matric_no=in.(A24TEST01,A24TEST02)", headers=headers)
print(f"2a. Check uploaded_documents for A24TEST01/A24TEST02: {len(r_chk.json())} rows")
r_ud = requests.delete(f"{url}/rest/v1/uploaded_documents?matric_no=in.({matrics_filter})", headers=headers)
print(f"2b. uploaded_documents delete: HTTP {r_ud.status_code} | deleted {len(r_ud.json()) if r_ud.status_code == 200 else r_ud.text}")

# 3. students
r_st = requests.delete(f"{url}/rest/v1/students?matric_no=in.({matrics_filter})", headers=headers)
print(f"3. students delete: HTTP {r_st.status_code} | deleted {len(r_st.json()) if r_st.status_code == 200 else r_st.text}")

# 4. advisors (excluding STAFF-LIYANA)
staff_filter = ",".join(test_staff)
r_ad = requests.delete(f"{url}/rest/v1/advisors?staff_id=in.({staff_filter})", headers=headers)
print(f"4. advisors delete: HTTP {r_ad.status_code} | deleted {len(r_ad.json()) if r_ad.status_code == 200 else r_ad.text}")

# 5. system_audit_logs
r_log = requests.delete(f"{url}/rest/v1/system_audit_logs?log_id=neq.00000000-0000-0000-0000-000000000000", headers=headers)
print(f"5. system_audit_logs delete: HTTP {r_log.status_code} | deleted {len(r_log.json()) if r_log.status_code == 200 else r_log.text}")

# 6. Delete the 4 auth.users accounts via admin API
print("\n6. Deleting auth.users test accounts via admin API:")
for u in users_before:
    if u.email in test_emails:
        res = admin.auth.admin.delete_user(u.id)
        print(f"   Deleted auth user: {u.email} (UID {u.id}) -> Result: {res}")

print("\n" + "=" * 80)
print("POST-DELETION TABLE COUNTS")
print("=" * 80)
counts_after = {t: count_table(t) for t in tables}
for t, c in counts_after.items():
    print(f"  public.{t}: {c} rows (was {counts_before[t]})")

users_after = admin.auth.admin.list_users()
print(f"  auth.users: {len(users_after)} users (was {len(users_before)})")
for u in users_after:
    print(f"   Remaining user: {u.email} (UID: {u.id})")
