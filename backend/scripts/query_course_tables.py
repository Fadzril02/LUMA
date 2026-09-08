import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
if not svc.client:
    print("[Error] Supabase client not initialized")
    sys.exit(1)

print("=" * 80)
print("QUERYING ALL TABLES MATCHING '%course%' IN PUBLIC SCHEMA")
print("=" * 80)

# Check individual course candidate tables
candidate_names = [
    "course", "courses", "course_catalog", "master_course_catalog",
    "course_prerequisite", "course_prerequisites", "course_structure",
    "backup_course_catalog_20260908", "backup_master_course_catalog_20260908"
]

matching_tables = []
for name in candidate_names:
    try:
        res = svc.client.table(name).select("*", count="exact").limit(1).execute()
        matching_tables.append((name, res.count))
        print(f"-> TABLE '{name}': EXISTS (row count = {res.count})")
    except Exception as e:
        err_msg = str(e)
        if "PGRST205" in err_msg or "Could not find the table" in err_msg:
            print(f"-> TABLE '{name}': DOES NOT EXIST (Not found in schema cache)")
        else:
            print(f"-> TABLE '{name}': ERROR ({err_msg})")

print("\nSummary of existing '%course%' tables in Supabase public schema:")
for tbl, cnt in matching_tables:
    print(f"  - public.{tbl} (rows: {cnt})")
