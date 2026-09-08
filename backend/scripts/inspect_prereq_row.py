import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
if not svc.client:
    print("[Error] Supabase client uninitialized")
    sys.exit(1)

res = svc.client.table("course_prerequisite").select("*").execute()
print("=" * 80)
print("EXACT ROW IN course_prerequisite TABLE:")
print("=" * 80)
for r in res.data or []:
    print(r)
    print("\nKeys & Types:")
    for k, v in r.items():
        print(f"  Column: '{k}' -> Value: {repr(v)} (Type: {type(v).__name__})")
