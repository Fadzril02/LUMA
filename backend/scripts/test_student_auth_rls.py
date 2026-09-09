import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

def run_test():
    print("=" * 80)
    print("RUNNING LIVE AUTH & RLS SECURITY VERIFICATION TEST")
    print("=" * 80)

    # 1. Initialize Clients
    svc = SupabaseService()
    admin_client = svc.client # Service role client
    anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

    # Real UTM Matric Number pattern: e.g. A23EC0199 or A24CS0088
    # Using real matric number format
    test_matric = "A24EC0991"
    generated_email = f"{test_matric.lower()}@student.utm.my"
    first_password = "Password123!Safe"
    second_password = "DifferentPassword456!"

    print(f"\n[STEP 1] Testing Sign up with REAL matric pattern: {test_matric}")
    print(f"Generated email: {generated_email}")

    # Clean up any existing test user first if present
    try:
        users_res = admin_client.auth.admin.list_users()
        for u in users_res:
            if u.email == generated_email or (u.user_metadata and u.user_metadata.get('matric_no') == test_matric):
                print(f"Cleaning up prior test user: {u.id} ({u.email})")
                admin_client.auth.admin.delete_user(u.id)
    except Exception as e:
        print(f"Cleanup note: {e}")

    # Also clean up student table row if needed
    try:
        admin_client.table("students").delete().eq("matric_no", test_matric).execute()
    except Exception as e:
        pass

    # Sign up Student 1
    # Exactly what StudentAuth.tsx + AuthContext.tsx do:
    print("\nAttempting 1st Sign-Up via Supabase Auth (Anon Client)...")
    try:
        signup_res1 = anon_client.auth.sign_up({
            "email": generated_email,
            "password": first_password,
            "options": {
                "data": {
                    "role": "student",
                    "matric_no": test_matric,
                    "full_name": "Ahmad Danial Test",
                    "advisor_staff_id": "STAFF-LIYANA"
                }
            }
        })
        user1 = signup_res1.user
        print(f"-> 1st Sign-Up Result: SUCCESS! User ID: {user1.id if user1 else 'None'}")
        print(f"   User email: {user1.email if user1 else 'None'}")
        print(f"   User metadata: {user1.user_metadata if user1 else 'None'}")
    except Exception as e:
        print(f"-> 1st Sign-Up Error: {e}")
        user1 = None

    # Step 2: Attempt to sign up a SECOND time using the same matric number but a different password/email
    print("\n" + "=" * 80)
    print(f"[STEP 2] Attempting 2nd Sign-Up with SAME matric number ({test_matric}) but different password / email")
    print("=" * 80)

    # Case 2A: Same generated email (default behavior if student types matric number)
    print("2A. Attempting sign-up with identical derived email and new password:")
    try:
        signup_res2a = anon_client.auth.sign_up({
            "email": generated_email,
            "password": second_password,
            "options": {
                "data": {
                    "role": "student",
                    "matric_no": test_matric,
                    "full_name": "Imposter Student",
                    "advisor_staff_id": "STAFF-LIYANA"
                }
            }
        })
        # Supabase Auth behavior on duplicate sign up:
        # If email confirmation is disabled or enabled, Supabase either returns an error or returns an empty identities list/existing user without changing password
        print(f"   Response User: {signup_res2a.user.id if signup_res2a.user else None}")
        print(f"   Identities: {len(signup_res2a.user.identities) if signup_res2a.user and signup_res2a.user.identities is not None else 'None'}")
        if signup_res2a.user and (not signup_res2a.user.identities or len(signup_res2a.user.identities) == 0):
            print("   [BLOCKED/PREVENTED]: Supabase returned an obfuscated response with 0 identities (user already registered). Password was NOT overwritten.")
        elif signup_res2a.user and signup_res2a.user.id == user1.id:
            print(f"   [BLOCKED/PREVENTED]: Existing user ID {signup_res2a.user.id} returned without altering original account.")
    except Exception as e:
        print(f"   [BLOCKED/FAILED with exception]: {e}")

    # Case 2B: Imposter uses a custom/different personal email but submits the victim's matric number
    imposter_email = "imposter999@gmail.com"
    print(f"\n2B. Attempting sign-up with DIFFERENT email ({imposter_email}) but VICTIM'S matric ({test_matric}):")
    try:
        signup_res2b = anon_client.auth.sign_up({
            "email": imposter_email,
            "password": second_password,
            "options": {
                "data": {
                    "role": "student",
                    "matric_no": test_matric,
                    "full_name": "Imposter Student",
                    "advisor_staff_id": "STAFF-LIYANA"
                }
            }
        })
        print(f"   Auth sign_up result: User ID {signup_res2b.user.id if signup_res2b.user else 'None'}")
        
        # Now check if database upsert fails or succeeds
        # In AuthContext.tsx, line 263:
        # supabase.from('students').upsert({ matric_no: matricNo, ... }, { onConflict: 'matric_no' })
        # Let's test with anon_client or authenticated imposter client:
        imposter_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        # Login as imposter
        login_res = imposter_client.auth.sign_in_with_password({"email": imposter_email, "password": second_password})
        print(f"   Imposter logged in with auth.uid() = {login_res.user.id}")

        # Attempt to insert/upsert victim's matric into 'students' table
        upsert_res = imposter_client.table("students").upsert({
            "matric_no": test_matric,
            "name": "Imposter Student",
            "program": "SECJ",
            "syllabus_type": "2023/2024",
            "advisor_staff_id": "STAFF-LIYANA",
            "institutional_email": imposter_email
        }, on_conflict="matric_no").execute()
        print(f"   Imposter table upsert response: {upsert_res.data}")
    except Exception as e:
        print(f"   Imposter attempt blocked/error: {e}")

    # Clean up imposter
    try:
        if 'signup_res2b' in locals() and signup_res2b.user:
            admin_client.auth.admin.delete_user(signup_res2b.user.id)
    except Exception:
        pass

    # Step 3: Login as student and inspect RLS policies on academic_records / students / results
    print("\n" + "=" * 80)
    print(f"[STEP 3] Log in as student ({test_matric}) and verify RLS enforcement on live DB")
    print("=" * 80)
    student_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    login_student = student_client.auth.sign_in_with_password({
        "email": generated_email,
        "password": first_password
    })
    print(f"Student authenticated successfully: auth.uid() = {login_student.user.id}")

    # Query academic_records as student
    try:
        ar_res = student_client.table("academic_records").select("*").execute()
        print(f"Query 'academic_records' as Student: {len(ar_res.data or [])} rows returned")
    except Exception as e:
        print(f"Query 'academic_records' error: {e}")

    # Query students table as student
    try:
        st_res = student_client.table("students").select("*").execute()
        print(f"Query 'students' as Student: {len(st_res.data or [])} rows returned (Checking if student can see other students' rows)")
        print(f"Returned matric numbers: {[r.get('matric_no') for r in (st_res.data or [])]}")
    except Exception as e:
        print(f"Query 'students' error: {e}")

    # Query uploaded_documents as student
    try:
        ud_res = student_client.table("uploaded_documents").select("*").execute()
        print(f"Query 'uploaded_documents' as Student: {len(ud_res.data or [])} rows returned")
    except Exception as e:
        print(f"Query 'uploaded_documents' error: {e}")

    # Inspect the exact Postgres RLS policies in pg_policies
    print("\n" + "=" * 80)
    print("4. Inspecting Database Live pg_policies & RLS status via RPC / SQL")
    print("=" * 80)
    try:
        # Check if we can query pg_policies via RPC or table
        policies = admin_client.rpc("get_policies").execute()
        print(f"Policies: {policies.data}")
    except Exception as e:
        print(f"Note: get_policies RPC: {e}")

    # Let's inspect live tables with anon vs authenticated vs service_role
    print("\nDone live test.")

if __name__ == "__main__":
    run_test()
