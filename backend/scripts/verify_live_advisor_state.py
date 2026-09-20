#!/usr/bin/env python3
"""
Verification script for Phase 0 Step 2:
1. Does the is_founding_advisor column actively exist in the live advisors table?
2. What is the current boolean value of is_founding_advisor for testing@utm.com?
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.supabase_client import SupabaseService

def main():
    svc = SupabaseService()
    admin = svc.client

    print("=" * 60)
    print("LIVE DATABASE VERIFICATION: ADVISORS TABLE")
    print("=" * 60)

    # 1. Check if column exists
    column_exists = False
    try:
        res = admin.table("advisors").select("is_founding_advisor").limit(1).execute()
        column_exists = True
        print("[1] Column 'is_founding_advisor' exists: YES")
    except Exception as e:
        print("[1] Column 'is_founding_advisor' exists: NO")
        print(f"    Error detail: {e}")

    # Inspect all columns from full select
    sample = admin.table("advisors").select("*").limit(1).execute()
    if sample.data:
        columns = list(sample.data[0].keys())
        print(f"    Current live columns on 'advisors': {columns}")
        if "is_founding_advisor" in columns:
            column_exists = True

    # 2. Check testing@utm.com
    print("-" * 60)
    adv_res = admin.table("advisors").select("*").eq("institutional_email", "testing@utm.com").execute()
    if adv_res.data:
        advisor = adv_res.data[0]
        print(f"Advisor record found for 'testing@utm.com':")
        print(f"  staff_id: {advisor.get('staff_id')}")
        print(f"  name: {advisor.get('name')}")
        print(f"  institutional_email: {advisor.get('institutional_email')}")
        if column_exists and "is_founding_advisor" in advisor:
            val = advisor.get("is_founding_advisor")
            print(f"[2] Value of is_founding_advisor for testing@utm.com: {val} (type: {type(val).__name__})")
        else:
            print(f"[2] Value of is_founding_advisor for testing@utm.com: N/A (Column does not exist in live database)")
    else:
        print("[2] Advisor with institutional_email = 'testing@utm.com' NOT FOUND")
    print("=" * 60)

if __name__ == "__main__":
    main()
