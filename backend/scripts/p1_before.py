"""
BEFORE test for P1: Students table RLS leak.
Student 1 (A24EC0991) queries the students table. Should return 1 row, currently returns 21+.
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

# Setup: Create a test student Auth user (matric A24EC0991)
student1_email = "a24ec0991@student.utm.my"
test_matric = "A24EC0991"

# Cleanup first
for u in admin.auth.admin.list_users():
    if u.email == student1_email:
        admin.auth.admin.delete_user(u.id)

u1 = admin.auth.admin.create_user({
    "email": student1_email,
    "password": "Password123!",
    "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": test_matric}
})
print(f"Created test auth user: id={u1.user.id}, email={u1.user.email}")

# Login as student
client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
client.auth.sign_in_with_password({"email": student1_email, "password": "Password123!"})
me = client.auth.get_user()
print(f"Logged in: auth.uid()={me.user.id}")

# Raw query of students table
print("\n--- BEFORE FIX: Raw students query (no filter) ---")
res = client.table("students").select("*").execute()
print(f"Total rows returned: {len(res.data or [])}")
print("Raw data:")
for r in (res.data or []):
    print(f"  {r}")

# Cleanup
admin.auth.admin.delete_user(u1.user.id)
