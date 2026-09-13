import os
import sys

sys.path.insert(0, os.path.abspath("backend"))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

print("=" * 80)
print("SECTION 7: TEST DATA INVENTORY (REPORT ONLY - NO DELETIONS)")
print("=" * 80)

# 1. Check Auth Users
print("\n1. Supabase Auth Users:")
auth_users = admin.auth.admin.list_users()
print(f"   Total Auth Users: {len(auth_users)}")
for u in auth_users:
    print(f"   - UID: {u.id} | Email: {u.email} | CreatedAt: {u.created_at} | Metadata: {u.user_metadata}")

# 2. Check advisors
print("\n2. Public Table: 'advisors':")
advisors_res = admin.table("advisors").select("*").execute()
advisors = advisors_res.data or []
print(f"   Total Rows in advisors: {len(advisors)}")
for a in advisors:
    print(f"   - staff_id: {a.get('staff_id')} | name: {a.get('name')} | email: {a.get('institutional_email')} | user_id: {a.get('user_id')}")

# 3. Check students
print("\n3. Public Table: 'students':")
students_res = admin.table("students").select("*").execute()
students = students_res.data or []
print(f"   Total Rows in students: {len(students)}")
for s in students:
    print(f"   - matric_no: {s.get('matric_no')} | name: {s.get('name')} | email: {s.get('institutional_email')} | advisor_staff_id: {s.get('advisor_staff_id')} | user_id: {s.get('user_id')}")

# 4. Check academic_records
print("\n4. Public Table: 'academic_records':")
ar_res = admin.table("academic_records").select("*").execute()
ar = ar_res.data or []
print(f"   Total Rows in academic_records: {len(ar)}")
for r in ar:
    print(f"   - matric_no: {r.get('matric_no')} | course_code: {r.get('course_code')} | grade: {r.get('grade')} | semester: {r.get('semester')}")

# 5. Check uploaded_documents
print("\n5. Public Table: 'uploaded_documents':")
docs_res = admin.table("uploaded_documents").select("*").execute()
docs = docs_res.data or []
print(f"   Total Rows in uploaded_documents: {len(docs)}")
for d in docs:
    print(f"   - id: {d.get('id')} | matric_no: {d.get('matric_no')} | status: {d.get('processing_status')} | file_path: {d.get('file_path')} | created_at: {d.get('created_at')}")

# 6. Check system_audit_logs
print("\n6. Public Table: 'system_audit_logs':")
logs_res = admin.table("system_audit_logs").select("*").execute()
logs = logs_res.data or []
print(f"   Total Rows in system_audit_logs: {len(logs)}")
for l in logs:
    print(f"   - id: {l.get('id')} | action: {l.get('action_type')} | table: {l.get('target_table')} | rec_id: {l.get('record_id')} | desc: {l.get('description')}")
