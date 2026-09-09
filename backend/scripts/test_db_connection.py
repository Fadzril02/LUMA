"""
Apply migration SQL using psycopg2 direct connection to Supabase Postgres.
Supabase DB connection string: 
  postgresql://postgres:[DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
  
The DB password must be provided by the user. Let's try to read from environment or prompt.
"""
import sys, os, psycopg2
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

project_ref = settings.SUPABASE_URL.split("//")[1].split(".")[0]

# Try common env vars for DB password
db_password = (
    os.environ.get("SUPABASE_DB_PASSWORD") or
    os.environ.get("DB_PASSWORD") or
    os.environ.get("POSTGRES_PASSWORD") or
    None
)

# Try reading from backend .env
backend_env = os.path.join(os.path.dirname(__file__), "../../backend/.env")
if os.path.exists(backend_env):
    with open(backend_env) as f:
        for line in f:
            line = line.strip()
            if "DB_PASSWORD" in line or "DATABASE_URL" in line:
                print(f"Found in backend .env: {line}")
                if "=" in line:
                    key, val = line.split("=", 1)
                    if val.strip():
                        db_password = val.strip()

if not db_password:
    print("ERROR: No DB password found in environment.")
    print("To apply the migration manually, go to:")
    print("  Supabase Dashboard > SQL Editor")
    print("  And run the contents of: supabase/migrations/05_student_auth_rls.sql")
    print()
    print("=" * 60)
    print("Alternatively, provide SUPABASE_DB_PASSWORD in your env.")
    print("=" * 60)
    sys.exit(1)

conn_str = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
print(f"Connecting to: postgresql://postgres:***@db.{project_ref}.supabase.co:5432/postgres")

try:
    conn = psycopg2.connect(conn_str, connect_timeout=10)
    print("Connected successfully!")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
