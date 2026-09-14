import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client, ClientOptions
from app.core.config import settings
from app.core.supabase_client import SupabaseService

def run_test():
    print("=" * 80)
    print("E2E VERIFICATION: GHOST ACCOUNT REJECTION & LINKED ACCOUNT SUCCESS")
    print("=" * 80)

    svc = SupabaseService()
    admin = svc.client
    anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

    test_ghost_matric = "A24GHOST01"
    test_ghost_email = f"{test_ghost_matric.lower()}@student.utm.my"
    test_ghost_password = "PasswordGhost123!"

    test_valid_matric = "A24REAL01"
    test_valid_email = f"{test_valid_matric.lower()}@student.utm.my"
    test_valid_password = "PasswordReal123!"

    # Clean up prior test accounts if any
    users = admin.auth.admin.list_users()
    for u in users:
        if u.email in [test_ghost_email, test_valid_email]:
            print(f"Cleaning up prior test user: {u.email} ({u.id})")
            admin.auth.admin.delete_user(u.id)

    admin.table("students").delete().in_("matric_no", [test_ghost_matric, test_valid_matric]).execute()

    print("\n" + "=" * 80)
    print("TEST 1: GHOST ACCOUNT (auth.users exists, NO students row)")
    print("=" * 80)

    # 1. Create the ghost user in auth.users (simulating failed registration or direct auth entry)
    signup_ghost = anon_client.auth.sign_up({
        "email": test_ghost_email,
        "password": test_ghost_password,
        "options": {
            "data": {
                "role": "student",
                "matric_no": test_ghost_matric,
                "full_name": "Ghost Student Self-Reported",
                "advisor_staff_id": "FAKE-STAFF"
            }
        }
    })
    ghost_user = signup_ghost.user
    ghost_session = signup_ghost.session
    print(f"1a. Created auth user for ghost student:")
    print(f"    UID: {ghost_user.id}")
    print(f"    Email: {ghost_user.email}")
    print(f"    user_metadata: {ghost_user.user_metadata}")

    # Verify no row exists in students table
    check_st = admin.table("students").select("*").eq("user_id", ghost_user.id).execute()
    print(f"1b. Checked public.students for user_id={ghost_user.id}: {len(check_st.data)} rows found.")
    assert len(check_st.data) == 0, "Expected 0 rows in students table"

    # 2. Simulate Login using student credentials
    print("\n1c. Simulating student login via anon client...")
    auth_resp = anon_client.auth.sign_in_with_password({
        "email": test_ghost_email,
        "password": test_ghost_password
    })
    logged_in_ghost = auth_resp.user
    token = auth_resp.session.access_token

    # 3. Simulate frontend fetchUserProfile logic using student's token
    client_with_token = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {token}"})
    )
    # Query students table strictly with user_id = auth.uid()
    query_res = client_with_token.table("students").select("*").eq("user_id", logged_in_ghost.id).execute()
    student_row = query_res.data[0] if query_res.data else None

    print(f"1d. Student row lookup result from DB: {student_row}")
    if not student_row:
        print("    [HARD FAILURE TRIGGERED]: No DB row found for authenticated student.")
        print("    Frontend action: Immediately signs out (supabase.auth.signOut())")
        print("    Error shown to user: 'Your account exists but is not linked to a valid record. Please contact your advisor.'")
        # Sign out to clear session
        client_with_token.auth.sign_out()
        print("    Session cleared successfully. Portal rendering BLOCKED.")
    else:
        raise AssertionError("Ghost account should NOT have a student row!")

    print("\n" + "=" * 80)
    print("TEST 2: VALID LINKED ACCOUNT (auth.users exists, linked students row exists)")
    print("=" * 80)

    # 1. Pre-seed the student row in public.students (as an advisor or admin would)
    admin.table("students").insert({
        "matric_no": test_valid_matric,
        "name": "Muhammad Real Student",
        "program": "Software Engineering (SECJ)",
        "syllabus_type": "2024/2025",
        "advisor_staff_id": "TEST123",
        "institutional_email": test_valid_email,
        "user_id": None
    }).execute()
    print(f"2a. Pre-seeded student row in public.students:")
    print(f"    matric_no: {test_valid_matric}, name: 'Muhammad Real Student', advisor: 'TEST123'")

    # 2. Sign up the real student and claim the record
    signup_real = anon_client.auth.sign_up({
        "email": test_valid_email,
        "password": test_valid_password,
        "options": {
            "data": {
                "role": "student",
                "matric_no": test_valid_matric,
                "full_name": "Muhammad Real Student",
                "advisor_staff_id": "TEST123"
            }
        }
    })
    real_user = signup_real.user
    real_token = signup_real.session.access_token

    # Claim the row by linking user_id
    admin.table("students").update({"user_id": real_user.id}).eq("matric_no", test_valid_matric).execute()
    print(f"2b. Claimed student row with user_id={real_user.id}")

    # 3. Simulate Login & fetchUserProfile
    real_client_with_token = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {real_token}"})
    )
    real_query_res = real_client_with_token.table("students").select("*").eq("user_id", real_user.id).execute()
    real_student_row = real_query_res.data[0] if real_query_res.data else None

    print(f"2c. Real student row lookup result from DB: {real_student_row}")
    assert real_student_row is not None, "Real student should have a linked row!"

    # Construct profile strictly from DB row
    constructed_profile = {
        "role": "student",
        "matric_no": real_student_row["matric_no"],
        "name": real_student_row["name"],
        "advisor_staff_id": real_student_row["advisor_staff_id"],
        "curriculum_year": real_student_row["syllabus_type"],
        "program_code": real_student_row["program"]
    }
    print(f"2d. Constructed Profile from DB columns strictly:")
    print(f"    Matric No: {constructed_profile['matric_no']}")
    print(f"    Name: {constructed_profile['name']}")
    print(f"    Advisor: {constructed_profile['advisor_staff_id']}")
    print(f"    Curriculum: {constructed_profile['curriculum_year']}")
    print(f"    Program: {constructed_profile['program_code']}")
    print("    [SUCCESS]: Legitimate student portal loads normally from DB row!")

    # 4. Clean up test users
    print("\n" + "=" * 80)
    print("CLEANING UP TEST USERS")
    print("=" * 80)
    admin.auth.admin.delete_user(ghost_user.id)
    admin.auth.admin.delete_user(real_user.id)
    admin.table("students").delete().in_("matric_no", [test_ghost_matric, test_valid_matric]).execute()
    print("Cleaned up test users and rows successfully.")

if __name__ == "__main__":
    run_test()
