"""
Live Verification Script:
Checks current rows in 'results', 'academic_records', and 'uploaded_documents'.
"""
import os
import sys

# Ensure backend package is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.supabase_client import SupabaseService

def main():
    svc = SupabaseService()
    if not svc.client:
        print("[Error] Supabase client not initialized")
        return

    # Check results table
    results_res = svc.client.table("results").select("id", count="exact").execute()
    print(f"Current 'results' table count: {results_res.count or len(results_res.data or [])}")

    # Check academic_records table
    academic_res = svc.client.table("academic_records").select("id, student_id, course_code, grade, grade_point, status, prerequisite_met", count="exact").execute()
    print(f"Current 'academic_records' table count: {academic_res.count or len(academic_res.data or [])}")
    print("Sample academic_records:")
    for r in (academic_res.data or [])[:5]:
        print(f"  {r}")

    # Check degree_audits table
    audits_res = svc.client.table("degree_audits").select("id, student_id, cgpa, overall_traffic_light", count="exact").execute()
    print(f"Current 'degree_audits' table count: {audits_res.count or len(audits_res.data or [])}")

    # Check uploaded_documents table
    docs_res = svc.client.table("uploaded_documents").select("id, matric_no, file_name, processing_status", count="exact").execute()
    print(f"Current 'uploaded_documents' count: {docs_res.count or len(docs_res.data or [])}")
    for d in (docs_res.data or [])[:5]:
        print(f"  Doc: {d['id']} | Matric: {d['matric_no']} | Status: {d['processing_status']}")

if __name__ == "__main__":
    main()
