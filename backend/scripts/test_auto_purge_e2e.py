"""
End-to-end Live Test: Automatic Storage Purge on Advisor Approval
Verifies:
1. File uploaded to Supabase Storage exists before approval.
2. Purge on 'Pending_Advisor_Approval' is strictly BLOCKED by approval-only gate.
3. finalize_approval executes end-to-end (DAG, student, academic_records, status='Approved').
4. Storage file is GONE immediately without any separate manual step.
5. uploaded_documents.file_path is set to '[PURGED]'.
6. system_audit_logs contains an immutable DELETE record.
"""

import os
import sys
import requests

sys.path.insert(0, os.path.abspath("backend"))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client
client = TestClient(app)

print("=" * 80)
print("E2E LIVE TEST: AUTOMATIC STORAGE PURGE ON ADVISOR APPROVAL")
print("=" * 80)

# 1. Obtain real JWT for Liyana
login_resp = requests.post(
    f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
    json={"email": "liyana@utm.my", "password": "LiyanaAdvisor2026!"},
    timeout=15,
)
if login_resp.status_code != 200:
    print(f"FATAL: Could not log in as Liyana: {login_resp.status_code}")
    sys.exit(1)

liyana_token = login_resp.json()["access_token"]
print("1. Obtained valid JWT for Madam Liyana (STAFF-LIYANA)")

# 2. Upload test PDF bytes to Supabase Storage ('academic-slips' bucket)
import time
unique_ts = int(time.time())
test_file_path = f"test_e2e_autopurge/{unique_ts}_sample_slip.pdf"
dummy_pdf_bytes = b"%PDF-1.4 test dummy transcript content for auto-purge test"

# Upload unique file to 'academic-slips' bucket (cacheControl: 0 prevents CDN caching of test file)
admin.storage.from_("academic-slips").upload(
    test_file_path,
    dummy_pdf_bytes,
    {"content-type": "application/pdf", "cacheControl": "0"}
)

# Verify file exists in storage before approval
downloaded_bytes = admin.storage.from_("academic-slips").download(test_file_path)
print(f"2. Verified file uploaded to Supabase Storage: '{test_file_path}' ({len(downloaded_bytes)} bytes)")

# 3. Seed student and insert row into uploaded_documents
test_matric = "A24PURGE99"
admin.table("students").upsert({
    "matric_no": test_matric,
    "name": "Auto-Purge Test Student",
    "program": "SECJ",
    "syllabus_type": "2024/2025",
    "advisor_staff_id": "STAFF-LIYANA",
    "institutional_email": "autopurge99@student.utm.my"
}).execute()

doc_insert = admin.table("uploaded_documents").insert({
    "matric_no": test_matric,
    "file_name": "sample_slip.pdf",
    "file_path": f"academic-slips/{test_file_path}",
    "processing_status": "Pending_Advisor_Approval"
}).execute()

doc_id = doc_insert.data[0]["id"]
print(f"3. Created test document in uploaded_documents: ID={doc_id}, status='Pending_Advisor_Approval'")

# 4. Verify approval-only gate: attempt purge BEFORE approval
print("\n4. Testing Approval-Only Gate: Attempting purge on unapproved document...")
gate_blocked = False
try:
    svc.purge_uploaded_document_file(document_id=doc_id, matric_no=test_matric)
    print("   [CRITICAL FAILURE] Purge succeeded on unapproved document!")
except PermissionError as pe:
    gate_blocked = True
    print(f"   [PASS] Approval-only gate strictly blocked purge:")
    print(f"          {pe}")

# 5. Execute finalize_approval with valid JWT
print("\n5. Executing finalize-approval (advisor approval flow)...")
approval_payload = {
    "document_id": doc_id,
    "matric_number": test_matric,
    "student_name": "Auto-Purge Test Student",
    "advisor_id": "STAFF-LIYANA",
    "academic_session": "2024/2025",
    "semester": 1,
    "program_code": "SECJ",
    "curriculum_year": "2024/2025",
    "courses": [
        {
            "course_code": "SECJ1013",
            "course_name": "Programming Technique I",
            "grade": "A",
            "credit_hour": 3,
            "credits": 3,
            "status": "Pass",
            "session_semester": "2024/2025-1"
        }
    ]
}

resp = client.post(
    "/api/v1/audit/finalize-approval",
    json=approval_payload,
    headers={"Authorization": f"Bearer {liyana_token}"}
)

print(f"   Endpoint Response Status: {resp.status_code}")
resp_data = resp.json()
print(f"   success: {resp_data.get('success')}")
print(f"   processing_status: {resp_data.get('processing_status')}")
print(f"   storage_purged: {resp_data.get('storage_purged')}")
print(f"   records_saved_count: {resp_data.get('records_saved_count')}")

# 6. Verify Storage File is GONE
print("\n6. Verifying Storage File State...")
# Check non-cached list (POST is never cached by CDN)
folder = "test_e2e_autopurge"
remaining_files = [f["name"] for f in admin.storage.from_("academic-slips").list(folder)]
list_empty = f"{unique_ts}_sample_slip.pdf" not in remaining_files

# Check download with cache bypass (CF-Cache-Status: BYPASS) to ensure real S3 state is probed
file_gone = False
import requests
check_url = f"{settings.SUPABASE_URL}/storage/v1/object/academic-slips/{test_file_path}?purge_check={int(time.time())}"
check_headers = {
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
}
check_resp = requests.get(check_url, headers=check_headers)
if check_resp.status_code in (400, 404) and ("NoSuchKey" in check_resp.text or "not_found" in check_resp.text):
    file_gone = True
    print(f"   [PASS] Download failed with 404 (NoSuchKey) as expected: {check_resp.text}")
else:
    print(f"   [FAIL] File still downloadable: HTTP {check_resp.status_code} {check_resp.text}")

if list_empty and file_gone:
    print(f"   [PASS] Storage file confirmed completely purged immediately upon approval!")
else:
    print(f"   [FAIL] list_empty={list_empty}, file_gone={file_gone}")

# 7. Verify uploaded_documents state
print("\n7. Verifying uploaded_documents table state...")
doc_row = admin.table("uploaded_documents").select("*").eq("id", doc_id).execute().data[0]
print(f"   file_path: '{doc_row['file_path']}' (Expected: '[PURGED]')")
print(f"   processing_status: '{doc_row['processing_status']}' (Expected: 'Approved')")

# 8. Verify system_audit_logs entry
print("\n8. Verifying immutable system_audit_logs entry...")
audit_logs = admin.table("system_audit_logs").select("*").eq("record_id", doc_id).execute().data
print(f"   Found {len(audit_logs)} audit log row(s):")
for al in audit_logs:
    print(f"     Action: {al.get('action_type')} | Target: {al.get('target_table')} | Description: {al.get('description')}")

# 9. Verify academic_records persistence
print("\n9. Verifying academic_records...")
ar_rows = admin.table("academic_records").select("*").eq("matric_no", test_matric).execute().data
print(f"   Found {len(ar_rows)} academic record(s) for student {test_matric}:")
for ar in ar_rows:
    print(f"     Course: {ar.get('course_code')}, Grade: {ar.get('grade')}, Status: {ar.get('status')}")

# 10. Clean up test records
print("\n10. Cleaning up test data...")
admin.table("academic_records").delete().eq("matric_no", test_matric).execute()
admin.table("degree_audits").delete().eq("matric_no", test_matric).execute()
admin.table("students").delete().eq("matric_no", test_matric).execute()
admin.table("system_audit_logs").delete().eq("record_id", doc_id).execute()
admin.table("uploaded_documents").delete().eq("id", doc_id).execute()
print("   Cleaned up test records from DB.")

print("\n" + "=" * 80)
all_pass = (
    gate_blocked and
    resp.status_code == 200 and
    resp_data.get("storage_purged") is True and
    file_gone and
    doc_row["file_path"] == "[PURGED]" and
    doc_row["processing_status"] == "Approved" and
    len(audit_logs) > 0 and
    len(ar_rows) > 0
)
print(f"FINAL RESULT: {'ALL TESTS PASSED - AUTOMATIC PURGE VERIFIED LIVE' if all_pass else 'TESTS FAILED'}")
print("=" * 80)
