import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
test_tables = [
    "advisors", "students", "course", "course_prerequisite", "intakes",
    "cohorts", "course_structure", "cohort_requirements", "results", 
    "uploaded_documents", "system_audit_logs", "admins", "backup_academic_results_20260908",
    "backup_course_catalog_20260908", "backup_master_course_catalog_20260908"
]

for tbl in test_tables:
    try:
        r = svc.client.table(tbl).select("*", count="exact").limit(1).execute()
        print(f"  Table '{tbl}': EXISTS (count={r.count})")
    except Exception as e:
        pass
