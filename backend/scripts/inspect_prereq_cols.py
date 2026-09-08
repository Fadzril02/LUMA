import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
if svc.client:
    r = svc.client.table("course_prerequisite").select("*").limit(5).execute()
    print("course_prerequisite rows:", r.data)
