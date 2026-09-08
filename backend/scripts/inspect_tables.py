import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
candidate_tables = [
    "academic_records", "academic_results", "results", "degree_audits", 
    "audits", "students", "uploaded_documents", "courses", "course_catalog",
    "master_course_catalog", "system_audit_logs", "admins", "users"
]

for tbl in candidate_tables:
    try:
        r = svc.client.table(tbl).select("*", count="exact").limit(1).execute()
        print(f"Table '{tbl}': EXISTS (count={r.count})")
    except Exception as e:
        print(f"Table '{tbl}': NOT FOUND / ERROR ({e})")
