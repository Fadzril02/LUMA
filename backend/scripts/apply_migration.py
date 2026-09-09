"""
Apply the migration SQL via Supabase's direct query REST API endpoint.
Uses the service role key to run raw SQL.
"""
import sys, os, requests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

SUPABASE_URL = settings.SUPABASE_URL
SERVICE_KEY = settings.SUPABASE_SERVICE_ROLE_KEY

# Read the migration file
migration_path = os.path.join(os.path.dirname(__file__), "../../supabase/migrations/05_student_auth_rls.sql")
migration_path = os.path.normpath(migration_path)

with open(migration_path, "r") as f:
    sql_content = f.read()

print(f"Loaded migration SQL ({len(sql_content)} chars)")

# Split by semicolons that are at the top level (not in strings)
# For simplicity, split on double-newline + semicolon pattern
# But the safest approach is to POST the whole thing as a single statement
# Supabase REST API doesn't support multi-statement execution directly.
# We need to split into individual statements.

import re

def split_sql_statements(sql):
    """Split SQL into individual statements, respecting $$ blocks."""
    statements = []
    current = []
    in_dollar_block = False
    
    lines = sql.split('\n')
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('--'):
            continue  # skip comment lines
        
        if '$$' in line:
            count = line.count('$$')
            if count % 2 == 1:
                in_dollar_block = not in_dollar_block
        
        current.append(line)
        
        if not in_dollar_block and stripped.endswith(';'):
            stmt = '\n'.join(current).strip()
            if stmt and stmt != ';':
                statements.append(stmt)
            current = []
    
    if current:
        stmt = '\n'.join(current).strip()
        if stmt:
            statements.append(stmt)
    
    return statements

statements = split_sql_statements(sql_content)
print(f"\nFound {len(statements)} SQL statements to execute:")
for i, stmt in enumerate(statements):
    first_line = stmt.split('\n')[0][:80]
    print(f"  [{i+1}] {first_line}")

# Execute each statement via Supabase REST
print("\n" + "=" * 60)
print("Executing statements...")
print("=" * 60)

def exec_sql(sql_stmt):
    """Execute SQL via Supabase's pg REST endpoint."""
    # Supabase provides a REST endpoint for SQL at /rest/v1/rpc/
    # but no generic SQL execution. We use the management API instead.
    # The Supabase project ref is: gexcsnwztzajoupgjhpc
    project_ref = SUPABASE_URL.split("//")[1].split(".")[0]
    url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
    
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    resp = requests.post(url, json={"query": sql_stmt}, headers=headers, timeout=30)
    return resp.status_code, resp.text

for i, stmt in enumerate(statements):
    first_line = stmt.split('\n')[0][:80]
    status, body = exec_sql(stmt)
    if status in (200, 201):
        print(f"  [OK]  [{i+1}] {first_line}")
    else:
        print(f"  [ERR] [{i+1}] {first_line}")
        print(f"         Status: {status}")
        print(f"         Body: {body[:300]}")
