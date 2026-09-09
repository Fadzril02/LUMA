import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client
anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

emails_to_test = [
    "a24ec0991@student.utm.my",
    "a24ec0991@graduate.utm.my",
    "a24ec0991@utm.my",
    "a24ec0991@gmail.com",
    "teststudent@example.com"
]

print("Testing admin.auth.admin.create_user with various emails:")
for email in emails_to_test:
    try:
        res = admin.auth.admin.create_user({
            "email": email,
            "password": "Password123!",
            "email_confirm": True,
            "user_metadata": {"role": "student", "matric_no": "A24EC0991"}
        })
        print(f"  Admin create [{email}]: SUCCESS (id={res.user.id})")
        # clean up
        admin.auth.admin.delete_user(res.user.id)
    except Exception as e:
        print(f"  Admin create [{email}]: FAILED ({e})")

print("\nTesting anon.auth.sign_up with various emails:")
for email in emails_to_test:
    try:
        res = anon.auth.sign_up({
            "email": email,
            "password": "Password123!",
            "options": {"data": {"role": "student", "matric_no": "A24EC0991"}}
        })
        print(f"  Anon sign_up [{email}]: SUCCESS (id={res.user.id if res.user else None})")
        if res.user:
            admin.auth.admin.delete_user(res.user.id)
    except Exception as e:
        print(f"  Anon sign_up [{email}]: FAILED ({e})")
