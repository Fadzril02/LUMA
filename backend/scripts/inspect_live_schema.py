import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

# Check pg_policies
print("Checking table columns and sample data:")
for table in ["students", "academic_records", "results", "degree_audits", "advisors", "uploaded_documents", "cohorts"]:
    try:
        res = admin.table(table).select("*").limit(2).execute()
        print(f"\n[TABLE: {table}] Rows: {len(res.data or [])}")
        if res.data:
            print(f"  Columns: {list(res.data[0].keys())}")
            print(f"  Sample row: {res.data[0]}")
    except Exception as e:
        print(f"\n[TABLE: {table}] Error: {e}")
