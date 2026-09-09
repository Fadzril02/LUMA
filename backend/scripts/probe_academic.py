import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

try:
    # insert dummy row to see columns or read schema
    res = admin.table("academic_records").insert({
        "matric_no": "DUMMY_PROBE_1",
        "course_code": "SECJ1013",
        "grade": "A",
        "status": "Pass"
    }).execute()
    print("Insert success:", res.data)
    admin.table("academic_records").delete().eq("matric_no", "DUMMY_PROBE_1").execute()
except Exception as e:
    print("Probe error:", e)
