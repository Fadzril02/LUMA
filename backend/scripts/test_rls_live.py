import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

# Insert sample records for Student 1 and Student 2
test_matric_1 = "A24EC0991"
test_matric_2 = "A24EC0882"

try:
    admin.table("academic_records").delete().in_("matric_no", [test_matric_1, test_matric_2]).execute()
    admin.table("academic_records").insert([
        {
            "matric_no": test_matric_1,
            "course_code": "SECJ1013",
            "course_name": "Programming Technique I",
            "semester": "1",
            "credits": 3,
            "grade": "A",
            "grade_point": 4.0,
            "status": "Pass",
            "prerequisite_met": True
        },
        {
            "matric_no": test_matric_2,
            "course_code": "SECJ1023",
            "course_name": "Programming Technique II",
            "semester": "2",
            "credits": 3,
            "grade": "B+",
            "grade_point": 3.33,
            "status": "Pass",
            "prerequisite_met": True
        }
    ]).execute()
    print("Inserted test academic records for both students.")
except Exception as e:
    print("Insert error:", e)

# Test unauthenticated (Anon)
anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
anon_all = anon.table("academic_records").select("*").execute()
print(f"\n1. ANON Query (No Auth): {len(anon_all.data or [])} rows returned")
if anon_all.data:
    for r in anon_all.data:
        print(f"   Anon row: matric={r.get('matric_no')}, course={r.get('course_code')}")

# Authenticate Student 1
student1_email = "a24ec0991@student.utm.my"
student2_email = "a24ec0882@student.utm.my"

# Ensure users exist in Auth
try:
    users = admin.auth.admin.list_users()
    for u in users:
        if u.email in [student1_email, student2_email]:
            admin.auth.admin.delete_user(u.id)

    u1 = admin.auth.admin.create_user({
        "email": student1_email,
        "password": "Password123!",
        "email_confirm": True,
        "user_metadata": {"role": "student", "matric_no": test_matric_1, "full_name": "Student One"}
    })
    u2 = admin.auth.admin.create_user({
        "email": student2_email,
        "password": "Password123!",
        "email_confirm": True,
        "user_metadata": {"role": "student", "matric_no": test_matric_2, "full_name": "Student Two"}
    })
    print(f"Created Auth User 1: {u1.user.id}")
    print(f"Created Auth User 2: {u2.user.id}")
except Exception as e:
    print("User creation error:", e)

# Log in as Student 1
client1 = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
client1.auth.sign_in_with_password({"email": student1_email, "password": "Password123!"})

# Query all academic records as Student 1
s1_all = client1.table("academic_records").select("*").execute()
print(f"\n2. Student 1 ({test_matric_1}) queries ALL academic_records without filter:")
print(f"   Total rows returned: {len(s1_all.data or [])}")
for r in (s1_all.data or []):
    print(f"   Record visible to Student 1: matric={r.get('matric_no')}, course={r.get('course_code')}, grade={r.get('grade')}")

# Query Student 2's specific record while logged in as Student 1
s1_query_s2 = client1.table("academic_records").select("*").eq("matric_no", test_matric_2).execute()
print(f"\n3. Student 1 specifically queries Student 2's matric ({test_matric_2}):")
print(f"   Total rows returned: {len(s1_query_s2.data or [])}")
for r in (s1_query_s2.data or []):
    print(f"   Record visible: matric={r.get('matric_no')}, course={r.get('course_code')}")

# Query students table as Student 1
s1_students = client1.table("students").select("*").execute()
print(f"\n4. Student 1 queries 'students' table:")
print(f"   Total rows returned: {len(s1_students.data or [])}")
for r in (s1_students.data or []):
    print(f"   Student row: matric={r.get('matric_no')}, name={r.get('name')}")

# Clean up
admin.table("academic_records").delete().in_("matric_no", [test_matric_1, test_matric_2]).execute()
admin.auth.admin.delete_user(u1.user.id)
admin.auth.admin.delete_user(u2.user.id)
print("\nCleanup completed.")
