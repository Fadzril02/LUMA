import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
if svc.client:
    r_courses = svc.client.table("course").select("*").execute()
    print("Courses in 'course' table:")
    for c in r_courses.data or []:
        print(f"  {c}")

    r_prereq = svc.client.table("course_prerequisite").select("*").execute()
    print("\nPrerequisites in 'course_prerequisite' table:")
    for p in r_prereq.data or []:
        print(f"  {p}")
