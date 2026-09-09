import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

test_matric_1 = "A24EC0991"
test_matric_2 = "A24EC0882"
student1_email = "a24ec0991@student.utm.my"
student2_email = "a24ec0882@student.utm.my"

# 1. Clean up
try:
    users = admin.auth.admin.list_users()
    for u in users:
        if u.email in [student1_email, student2_email]:
            admin.auth.admin.delete_user(u.id)
    admin.table("academic_records").delete().in_("matric_no", [test_matric_1, test_matric_2]).execute()
    admin.table("students").delete().in_("matric_no", [test_matric_1, test_matric_2]).execute()
except Exception as e:
    pass

# 2. Insert students records
admin.table("students").insert([
    {
        "matric_no": test_matric_1,
        "name": "Student Real One",
        "program": "SECJ",
        "syllabus_type": "2023/2024",
        "advisor_staff_id": "ADV-01",
        "institutional_email": student1_email
    },
    {
        "matric_no": test_matric_2,
        "name": "Student Real Two",
        "program": "SECJ",
        "syllabus_type": "2023/2024",
        "advisor_staff_id": "ADV-01",
        "institutional_email": student2_email
    }
]).execute()

# 3. Insert academic records
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

print("Inserted test student rows and academic_records rows.")

# 4. Create Auth Users
u1 = admin.auth.admin.create_user({
    "email": student1_email,
    "password": "Password123!",
    "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": test_matric_1, "full_name": "Student Real One"}
})
u2 = admin.auth.admin.create_user({
    "email": student2_email,
    "password": "Password123!",
    "email_confirm": True,
    "user_metadata": {"role": "student", "matric_no": test_matric_2, "full_name": "Student Real Two"}
})

# 5. Query as Anon (Unauthenticated)
anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
anon_ar = anon.table("academic_records").select("*").execute()
print(f"\n[ANON] academic_records query: {len(anon_ar.data or [])} rows returned")
for r in (anon_ar.data or []):
    print(f"  Anon saw: matric={r.get('matric_no')}, course={r.get('course_code')}")

# 6. Log in as Student 1
client1 = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
client1.auth.sign_in_with_password({"email": student1_email, "password": "Password123!"})

s1_ar = client1.table("academic_records").select("*").execute()
print(f"\n[STUDENT 1 (A24EC0991)] academic_records query (no filter): {len(s1_ar.data or [])} rows returned")
for r in (s1_ar.data or []):
    print(f"  Student 1 saw: matric={r.get('matric_no')}, course={r.get('course_code')}")

s1_query_s2 = client1.table("academic_records").select("*").eq("matric_no", test_matric_2).execute()
print(f"[STUDENT 1] query filtering Student 2's matric ({test_matric_2}): {len(s1_query_s2.data or [])} rows returned")
for r in (s1_query_s2.data or []):
    print(f"  Student 1 saw Student 2 data: matric={r.get('matric_no')}, course={r.get('course_code')}")

# 7. Check 'students' table access for Student 1
s1_st = client1.table("students").select("*").execute()
print(f"\n[STUDENT 1] students query (no filter): {len(s1_st.data or [])} rows returned")

# Cleanup
admin.table("academic_records").delete().in_("matric_no", [test_matric_1, test_matric_2]).execute()
admin.table("students").delete().in_("matric_no", [test_matric_1, test_matric_2]).execute()
admin.auth.admin.delete_user(u1.user.id)
admin.auth.admin.delete_user(u2.user.id)
print("\nTest completed and cleaned up.")
