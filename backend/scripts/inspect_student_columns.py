import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
if svc.client:
    r = svc.client.table("students").select("*").limit(1).execute()
    print("Students columns:", list(r.data[0].keys()) if r.data else "empty")
