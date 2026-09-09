import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

users = admin.auth.admin.list_users()
print(f"Total existing users in Supabase Auth: {len(users)}")
for u in users:
    print(f"User: id={u.id} | email={u.email} | metadata={u.user_metadata}")
