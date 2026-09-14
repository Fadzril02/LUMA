import sys, os, json
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

def main():
    svc = SupabaseService()
    admin = svc.client

    # 1. Fetch all auth users
    # Note: list_users might have pagination; let's check
    page = 1
    per_page = 100
    all_auth_users = []
    while True:
        try:
            users_page = admin.auth.admin.list_users(page=page, per_page=per_page)
            if not users_page:
                break
            all_auth_users.extend(users_page)
            if len(users_page) < per_page:
                break
            page += 1
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

    print(f"Total Auth Users found: {len(all_auth_users)}")

    # 2. Fetch all students
    students_res = admin.table("students").select("*").execute()
    students = students_res.data or []
    print(f"Total Students found in DB: {len(students)}")

    # Map students by user_id
    students_by_user_id = {s.get("user_id"): s for s in students if s.get("user_id")}
    students_by_matric = {s.get("matric_no"): s for s in students if s.get("matric_no")}

    # Also fetch advisors to distinguish advisor accounts from student accounts
    advisors_res = admin.table("advisors").select("*").execute()
    advisors = advisors_res.data or []
    advisors_by_user_id = {a.get("user_id"): a for a in advisors if a.get("user_id")}

    print(f"Total Advisors found in DB: {len(advisors)}")

    print("\n" + "="*80)
    print("ALL STUDENTS IN DATABASE:")
    print("="*80)
    for s in students:
        print(f"matric_no: {s.get('matric_no')} | name: {s.get('name')} | user_id: {s.get('user_id')} | email: {s.get('institutional_email')} | advisor: {s.get('advisor_staff_id')}")

    print("\n" + "="*80)
    print("ALL AUTH USERS & CLASSIFICATION:")
    print("="*80)

    ghost_student_accounts = []
    ghost_other_accounts = []
    linked_student_accounts = []
    linked_advisor_accounts = []

    for u in all_auth_users:
        user_id = str(u.id)
        email = str(u.email)
        created_at = str(u.created_at)
        metadata = u.user_metadata or {}
        role = metadata.get("role") or "unknown"

        s_row = students_by_user_id.get(user_id)
        a_row = advisors_by_user_id.get(user_id)

        if s_row:
            linked_student_accounts.append({
                "user_id": user_id,
                "email": email,
                "created_at": created_at,
                "student_row": s_row,
                "metadata": metadata
            })
        elif a_row:
            linked_advisor_accounts.append({
                "user_id": user_id,
                "email": email,
                "created_at": created_at,
                "advisor_row": a_row,
                "metadata": metadata
            })
        else:
            # Check if metadata indicates it was supposed to be a student
            if role == "student" or metadata.get("matric_no") or "@student.utm.my" in email:
                ghost_student_accounts.append({
                    "user_id": user_id,
                    "email": email,
                    "created_at": created_at,
                    "metadata": metadata
                })
            else:
                ghost_other_accounts.append({
                    "user_id": user_id,
                    "email": email,
                    "created_at": created_at,
                    "metadata": metadata
                })

    print(f"\n1. LINKED STUDENT ACCOUNTS ({len(linked_student_accounts)}):")
    for a in linked_student_accounts:
        print(f"  - UID: {a['user_id']} | Email: {a['email']} | Matric: {a['student_row'].get('matric_no')} | Name: {a['student_row'].get('name')}")

    print(f"\n2. LINKED ADVISOR ACCOUNTS ({len(linked_advisor_accounts)}):")
    for a in linked_advisor_accounts:
        print(f"  - UID: {a['user_id']} | Email: {a['email']} | Staff ID: {a['advisor_row'].get('staff_id')} | Name: {a['advisor_row'].get('name')}")

    print(f"\n3. GHOST STUDENT ACCOUNTS (Auth user with role=student / matric_no but NO matching students row) ({len(ghost_student_accounts)}):")
    for g in ghost_student_accounts:
        print(f"\n  User ID: {g['user_id']}")
        print(f"  Email: {g['email']}")
        print(f"  Created At: {g['created_at']}")
        print(f"  user_metadata: {json.dumps(g['metadata'], indent=4)}")

    print(f"\n4. OTHER UNLINKED AUTH ACCOUNTS ({len(ghost_other_accounts)}):")
    for o in ghost_other_accounts:
        print(f"\n  User ID: {o['user_id']}")
        print(f"  Email: {o['email']}")
        print(f"  Created At: {o['created_at']}")
        print(f"  user_metadata: {json.dumps(o['metadata'], indent=4)}")

if __name__ == "__main__":
    main()
