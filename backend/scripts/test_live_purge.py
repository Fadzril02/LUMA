import os
import sys

sys.path.insert(0, os.path.abspath("backend"))
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

print("=" * 80)
print("SECTION 4: DATA LIFECYCLE & PURGE ENFORCEMENT AUDIT (LIVE SUPABASE)")
print("=" * 80)

advisor_staff = "STAFF-PURGE01"
student_matric = "A24PURGE01"

# 1. Ensure prerequisite advisor & student exist
admin.table("advisors").upsert({
    "staff_id": advisor_staff,
    "name": "Purge Test Advisor",
    "department": "Software Engineering",
    "institutional_email": "purge_advisor@utm.my"
}).execute()

admin.table("students").upsert({
    "matric_no": student_matric,
    "name": "Purge Test Student",
    "program": "SECJ",
    "syllabus_type": "2023/2024",
    "advisor_staff_id": advisor_staff,
    "institutional_email": "purge_student@student.utm.my"
}).execute()

print(f"1. Seeded student {student_matric} and advisor {advisor_staff}")

# 2. Insert document with non-approved status
doc = {
    "matric_no": student_matric,
    "file_name": "test_slip_lifecycle.pdf",
    "file_path": "slips/test_slip_lifecycle.pdf",
    "processing_status": "Pending_Student_Verification"
}

res = admin.table("uploaded_documents").insert(doc).execute()
test_doc = res.data[0]
doc_id = test_doc["id"]
print(f"2. Created uploaded_document row ID: {doc_id}")
print(f"   Current processing_status: '{test_doc['processing_status']}'")

print("\n3. Attempting purge on non-approved document ('Pending_Student_Verification')...")
try:
    svc.purge_uploaded_document_file(document_id=doc_id, admin_staff_id="ADMIN1")
    print("   [CRITICAL FAILURE] Purge succeeded on non-approved document!")
except PermissionError as pe:
    print("   [PASS - REJECTED WITH EXPECTED PERMISSION ERROR]:")
    print(f"   Raw Exception: {pe}")
except Exception as e:
    print(f"   Unexpected exception: {type(e)} {e}")

print("\n4. Promoting document status to 'Approved'...")
admin.table("uploaded_documents").update({"processing_status": "Approved"}).eq("id", doc_id).execute()
updated_doc = admin.table("uploaded_documents").select("*").eq("id", doc_id).execute().data[0]
print(f"   Updated processing_status in DB: '{updated_doc['processing_status']}'")

print("\n5. Executing purge on 'Approved' document...")
purge_result = svc.purge_uploaded_document_file(document_id=doc_id, admin_staff_id="ADMIN1")
print("   [PASS - PURGE SUCCEEDED]:")
for k, v in purge_result.items():
    print(f"     {k}: {v}")

print("\n6. Verifying database state post-purge:")
verify_doc = admin.table("uploaded_documents").select("*").eq("id", doc_id).execute().data[0]
print(f"   file_path: '{verify_doc['file_path']}' (Expected '[PURGED]')")
print(f"   processing_status: '{verify_doc['processing_status']}'")

print("\n7. Verifying immutable audit entry in system_audit_logs:")
logs = admin.table("system_audit_logs").select("*").eq("record_id", doc_id).execute().data
print(f"   Found {len(logs)} audit log row(s):")
for l in logs:
    print(f"     ID: {l.get('id')}")
    print(f"     Action: {l.get('action_type')}")
    print(f"     Target Table: {l.get('target_table')}")
    print(f"     Admin Staff ID: {l.get('admin_staff_id')}")
    print(f"     Description: {l.get('description')}")
    print(f"     Created At: {l.get('created_at')}")
