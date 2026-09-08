import urllib.request
import json
from app.core.config import settings

url = f"{settings.SUPABASE_URL}/rest/v1/"
req = urllib.request.Request(url, headers={
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
})
try:
    with urllib.request.urlopen(req) as resp:
        spec = json.loads(resp.read().decode())
        definitions = list(spec.get("definitions", {}).keys())
        print("All Tables / Views exposed in Supabase PostgREST API:")
        for d in definitions:
            print(f"  - {d}")
except Exception as e:
    print(f"Error fetching PostgREST spec: {e}")
