"""
Full live schema audit:
- Dumps all tables, their columns, types, nullable status
- Dumps all RLS policies as currently applied in the live DB
- Checks for user_id column on students
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.supabase_client import SupabaseService
from supabase import create_client
from app.core.config import settings

svc = SupabaseService()
admin = svc.client

print("=" * 80)
print("FULL LIVE SCHEMA AUDIT")
print("=" * 80)

# 1. Get all column info via information_schema via RPC
# We'll use a raw SQL call via rpc
sql = """
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
"""

try:
    res = admin.rpc("exec_sql", {"query": sql}).execute()
    print("Column info via RPC exec_sql:", res.data)
except Exception as e:
    print(f"exec_sql RPC not available: {e}")
    print("Falling back to PostgREST OpenAPI spec...")

# 2. Fallback: Use OpenAPI spec
import urllib.request, json

url = f"{settings.SUPABASE_URL}/rest/v1/"
req = urllib.request.Request(url, headers={
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
})
with urllib.request.urlopen(req) as resp:
    spec = json.loads(resp.read().decode())
    for table_name, table_def in spec.get("definitions", {}).items():
        props = table_def.get("properties", {})
        required = table_def.get("required", [])
        print(f"\n[TABLE: {table_name}]")
        for col, col_def in props.items():
            col_type = col_def.get("type") or col_def.get("format") or str(col_def)
            nullable = "NOT NULL" if col in required else "nullable"
            print(f"  {col}: {col_type} ({nullable})")

print("\n" + "=" * 80)
print("RLS POLICIES (live pg_policies)")
print("=" * 80)

# 3. Check pg_policies via a custom function or direct query
# Supabase exposes pg_catalog tables through REST if schema is exposed, but usually not
# Try via rpc
rls_sql = """
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"""
try:
    res = admin.rpc("query", {"sql": rls_sql}).execute()
    print(res.data)
except Exception as e:
    print(f"Could not query pg_policies via RPC: {e}")
    print("You must check the Supabase Dashboard > Auth > Policies tab manually,")
    print("or grant the service role execute on a helper function.")

# 4. Check if students table has user_id column
print("\n" + "=" * 80)
print("STUDENTS TABLE: checking for user_id column")
print("=" * 80)
import urllib.request, json
url = f"{settings.SUPABASE_URL}/rest/v1/"
req = urllib.request.Request(url, headers={
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
})
with urllib.request.urlopen(req) as resp:
    spec = json.loads(resp.read().decode())
    students_def = spec.get("definitions", {}).get("students", {})
    props = list(students_def.get("properties", {}).keys())
    print(f"students columns: {props}")
    print(f"user_id present: {'user_id' in props}")
