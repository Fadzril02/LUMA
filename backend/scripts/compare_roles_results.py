import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService
from app.core.config import settings
from supabase import create_client

svc = SupabaseService()
anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Check results table with service role
try:
    r_srv = svc.client.table("results").select("*").limit(1).execute()
    print(f"Service Role SELECT 'results': SUCCESS ({len(r_srv.data)} rows)")
except Exception as e:
    print(f"Service Role SELECT 'results': ERROR ({e})")

# Check results table with anon
try:
    r_anon = anon.table("results").select("*").limit(1).execute()
    print(f"Anon Role SELECT 'results': SUCCESS ({len(r_anon.data)} rows)")
except Exception as e:
    print(f"Anon Role SELECT 'results': ERROR ({e})")
