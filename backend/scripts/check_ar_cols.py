import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

# Query via postgrest spec or inspect error
try:
    admin.table("academic_records").insert({"matric_no": "TEST"}).execute()
except Exception as e:
    print(e)
