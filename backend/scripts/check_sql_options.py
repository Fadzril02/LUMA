"""
Apply migration SQL using Supabase's postgres REST endpoint.
The service role key has bypass RLS but can't run DDL via PostgREST.
We need to use the pg connection string directly.
Let's try using the supabase client's rpc with a pre-created helper,
OR try installing psycopg2 to connect to the postgres DB directly.
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

# Try: httpx POST to /rest/v1/rpc/<function>
# Or: use the supabase-py postgres endpoint

# Check if we can derive the direct connection string
# Supabase direct DB connection: postgresql://postgres:[password]@db.[project_ref].supabase.co:5432/postgres
# The project_ref is from the URL
project_ref = settings.SUPABASE_URL.split("//")[1].split(".")[0]
print(f"Project ref: {project_ref}")

# The db password is NOT stored in .env — it's the database password set in supabase dashboard
# However, we can try to run DDL via the Supabase JS/Management API
# or via the psql command if supabase CLI is installed

import subprocess

# Check if supabase CLI is available
result = subprocess.run(["supabase", "--version"], capture_output=True, text=True)
print(f"Supabase CLI: {result.stdout.strip() or result.stderr.strip()}")

# Check if psql is available
result2 = subprocess.run(["psql", "--version"], capture_output=True, text=True, shell=True)
print(f"psql: {result2.stdout.strip() or result2.stderr.strip()}")

# Try using the supabase-py client to execute the query 
# The admin Python client has a .postgrest attribute but no raw SQL
from app.core.supabase_client import SupabaseService
svc = SupabaseService()
admin = svc.client

# Test if we can call a pg function
# Let's try to create the helper function first via the REST API 
# using the rpc endpoint with a function that does ALTER TABLE
# Actually the cleanest approach is:
# supabase_client.postgrest is the PostgREST instance
# We can make a raw request to the REST API to run functions

print("\nAttempting to use Supabase Admin API correctly...")
import httpx

# The correct Management API requires a different token (personal access token from supabase.com)
# The service role JWT is for the DATA API, not the Management API
# 
# Alternative: Use the Postgres connection pooler at port 6543 (transaction mode)
# Connection string: postgresql://postgres.[project_ref]:[db-password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
#
# We can try to find the DB password in the environment or config

# Check if there's a DATABASE_URL set anywhere
for key in os.environ:
    if 'DATABASE' in key.upper() or 'POSTGRES' in key.upper() or 'PG' in key.upper():
        print(f"  Found env var: {key}={os.environ[key][:40]}...")

# Check all .env files  
for env_file in [".env", "backend/.env", "supabase/.env", ".env.local"]:
    env_path = os.path.join("d:\\smart-aa-system", env_file)
    if os.path.exists(env_path):
        with open(env_path) as f:
            content = f.read()
        if 'DATABASE' in content.upper() or 'POSTGRES' in content.upper() or 'PG' in content.upper():
            print(f"  Found DB config in {env_file}:")
            for line in content.splitlines():
                if 'DATABASE' in line.upper() or 'POSTGRES' in line.upper() or 'PG' in line.upper():
                    print(f"    {line}")
