"""
Diagnose: Check what RLS policies actually exist on the live students table.
The migration added new policies but some old unrestricted policy may still exist.
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client
URL = settings.SUPABASE_URL

# We can't query pg_policies via RPC, so let's infer by testing behavior
# with service role vs. anon

# 1. Check if RLS is enabled at all on students
# We'll test: anon user (no auth) should get 0 rows if RLS is enabled
anon = create_client(URL, settings.SUPABASE_ANON_KEY)
anon_res = anon.table("students").select("*").limit(1).execute()
print(f"Anon (no auth) query students: {len(anon_res.data or [])} rows")
print(f"  (if > 0, RLS is disabled or there is a permissive policy for anon/public role)")

# 2. Check student user with user_id set
test_matric = "SE24-STUDENT01"
test_email = "se24-student01@student.utm.my"
test_password = "AfterFixTest123!"

# Cleanup and recreate user with user_id
for u in admin.auth.admin.list_users():
    if u.email == test_email:
        admin.table("students").update({"user_id": None}).eq("matric_no", test_matric).execute()
        admin.auth.admin.delete_user(u.id)

u1 = admin.auth.admin.create_user({
    "email": test_email, "password": test_password, "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": test_matric}
})
admin.table("students").update({"user_id": u1.user.id}).eq("matric_no", test_matric).execute()

client = create_client(URL, settings.SUPABASE_ANON_KEY)
client.auth.sign_in_with_password({"email": test_email, "password": test_password})

# Check students query - what does the student see?
student_res = client.table("students").select("matric_no, user_id").execute()
print(f"\nAuthenticated student query students (select matric_no, user_id): {len(student_res.data or [])} rows")
for r in student_res.data or []:
    print(f"  matric_no={r.get('matric_no')}, user_id={r.get('user_id')}")

# 3. Try to understand what policies exist by checking if there's an unrestricted 'anon' policy
# The students table might have a PERMISSIVE SELECT policy without any USING clause
# Check if the old policies (before migration) were: no policies = open to all, or there was a specific one
# Try different roles
print("\nChecking RLS enabled status by testing with service_role vs anon...")
service_res = admin.table("students").select("matric_no").execute()
print(f"Service role (bypasses RLS): {len(service_res.data or [])} rows")

# Cleanup
admin.table("students").update({"user_id": None}).eq("matric_no", test_matric).execute()
admin.auth.admin.delete_user(u1.user.id)
