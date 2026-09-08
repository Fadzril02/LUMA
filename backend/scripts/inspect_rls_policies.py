import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
if not svc.client:
    print("[Error] Supabase client uninitialized")
    sys.exit(1)

print("=" * 80)
print("INSPECTING RLS AND DIRECT QUERY ACCESS WITH ANON VS SERVICE ROLE")
print("=" * 80)

# Check RLS on tables using SQL or querying with anon client
from supabase import create_client
from app.core.config import settings

anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY) if settings.SUPABASE_ANON_KEY else None

tables_to_test = [
    "results", "students", "uploaded_documents", "course", "course_prerequisite",
    "advisors", "system_audit_logs", "academic_records", "degree_audits"
]

print(f"\n1. Testing unauthenticated (Anon Key) SELECT queries:")
for tbl in tables_to_test:
    if anon_client:
        try:
            res = anon_client.table(tbl).select("*").limit(3).execute()
            print(f"  [ANON READ] '{tbl}': SUCCESS (Rows returned: {len(res.data or [])})")
            if res.data:
                sample_cols = list(res.data[0].keys())
                print(f"     Columns: {sample_cols[:6]}")
        except Exception as e:
            print(f"  [ANON READ] '{tbl}': BLOCKED/ERROR ({e})")
    else:
        print("  [ANON READ] No SUPABASE_ANON_KEY configured to test")

print("\n" + "=" * 80)
print("2. Testing unauthenticated (Anon Key) SELECT with matric_no filter on 'results':")
print("=" * 80)
if anon_client:
    try:
        res = anon_client.table("results").select("*").eq("matric_no", "A24MJ5050").execute()
        print(f"  Query results by matric_no='A24MJ5050': {len(res.data or [])} rows returned without any auth token!")
        for r in (res.data or [])[:3]:
            print(f"    {r}")
    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "=" * 80)
print("3. Testing unauthenticated (Anon Key) SELECT on 'students':")
print("=" * 80)
if anon_client:
    try:
        res = anon_client.table("students").select("*").limit(3).execute()
        print(f"  Query students: {len(res.data or [])} rows returned without any auth token!")
        for s in (res.data or [])[:3]:
            print(f"    Student: {s.get('matric_no') or s.get('matric_number')} | Name: {s.get('name') or s.get('full_name')}")
    except Exception as e:
        print(f"  Error: {e}")
