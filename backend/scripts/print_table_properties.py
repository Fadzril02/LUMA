import urllib.request
import json
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

url = f"{settings.SUPABASE_URL}/rest/v1/"
req = urllib.request.Request(url, headers={
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
})
with urllib.request.urlopen(req) as resp:
    spec = json.loads(resp.read().decode())
    ar_def = spec.get("definitions", {}).get("academic_records", {})
    print("academic_records properties:", list(ar_def.get("properties", {}).keys()))
    students_def = spec.get("definitions", {}).get("students", {})
    print("students properties:", list(students_def.get("properties", {}).keys()))
