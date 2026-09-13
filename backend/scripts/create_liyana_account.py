import os
import sys
import requests

sys.path.insert(0, os.path.abspath("backend"))
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

email = "liyana@utm.my"
password = "LiyanaAdvisor2026!"
staff_id = "STAFF-LIYANA"
full_name = "Madam Liyana"
metadata = {
    "role": "advisor",
    "staff_id": staff_id,
    "full_name": full_name
}

print(f"Ensuring Auth user for {email}...")
existing_users = {u.email: u.id for u in admin.auth.admin.list_users()}

if email in existing_users:
    uid = existing_users[email]
    admin.auth.admin.update_user_by_id(uid, {
        "password": password,
        "email_confirm": True,
        "user_metadata": metadata
    })
    print(f"Updated existing user UID: {uid}")
else:
    u = admin.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": metadata
    })
    uid = u.user.id
    print(f"Created new user UID: {uid}")

# Link to advisors table
headers = {
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Upsert advisor record
r_adv = requests.post(
    f"{settings.SUPABASE_URL}/rest/v1/advisors",
    headers={**headers, "Prefer": "resolution=merge-duplicates,return=representation"},
    json={
        "staff_id": staff_id,
        "name": full_name,
        "department": "Software Engineering",
        "institutional_email": email,
        "user_id": uid
    }
)
print(f"Advisor record upsert: {r_adv.status_code}")
print(r_adv.json() if r_adv.status_code in [200, 201] else r_adv.text)

# Test login with Anon key
r_login = requests.post(
    f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
    json={"email": email, "password": password}
)
print(f"Test login status: {r_login.status_code}")
if r_login.status_code == 200:
    print("SUCCESS: Madam Liyana can log in successfully!")
    data = r_login.json()
    print("Access token received:", data["access_token"][:30] + "...")
else:
    print("Login failed:", r_login.text)
