"""
[PROJECT_NAME] Supabase Service Role Integration
Company: [COMPANY_NAME]
"""

from typing import Dict, Any, List, Optional
from supabase import create_client, Client
from backend.app.core.config import settings
from backend.app.schemas.audit import CourseAuditResult, AuditSummary


class SupabaseService:
    def __init__(self):
        url = settings.SUPABASE_URL
        # Prioritize Service Role Key to bypass RLS when downloading from private bucket and writing audits
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        if not url or not key:
            print("[Warning] Supabase URL or Key not set in environment.")
            self.client: Optional[Client] = None
        else:
            self.client: Client = create_client(url, key)

    def download_transcript_bytes(self, storage_path: str) -> bytes:
        """
        Downloads PDF bytes from private 'transcripts' bucket using Service Role privileges.
        """
        if not self.client:
            raise ValueError("Supabase client is uninitialized.")
        
        # storage_path may be 'transcripts/advisor_id/filename.pdf' or 'advisor_id/filename.pdf'
        clean_path = storage_path.removeprefix("transcripts/").removeprefix("/")
        
        res = self.client.storage.from_("transcripts").download(clean_path)
        return res

    def get_university_course_catalog(self, university_id: str) -> Dict[str, Dict[str, Any]]:
        """
        Fetches all courses and prerequisites for a given university.
        Returns dict: course_code -> course_data
        """
        if not self.client:
            return {}
        
        res = self.client.table("courses").select("*").eq("university_id", university_id).execute()
        catalog: Dict[str, Dict[str, Any]] = {}
        for row in res.data or []:
            code = row["code"].replace(" ", "").upper()
            catalog[code] = row
        return catalog

    def upsert_courses_bulk(self, university_id: str, courses: List[Dict[str, Any]]) -> int:
        """
        Bulk upserts parsed courses into the database for the given university.
        """
        if not self.client or not courses:
            return 0
        
        records = [
            {
                "university_id": university_id,
                "code": c["code"],
                "name": c["name"],
                "credits": c["credits"],
                "category": c.get("category", "Core"),
                "prerequisites": c["prerequisites"]
            }
            for c in courses
        ]
        
        res = self.client.table("courses").upsert(
            records,
            on_conflict="university_id,code"
        ).execute()
        
        return len(res.data) if res.data else len(records)

    def get_or_create_student(
        self,
        university_id: str,
        advisor_id: str,
        matric_number: str,
        student_name: str,
        curriculum_year: str = "2023/2024",
        program_code: str = "SECJ"
    ) -> Dict[str, Any]:
        """
        Finds existing student or inserts a new student record.
        """
        if not self.client:
            return {"id": "00000000-0000-0000-0000-000000000000", "matric_number": matric_number}

        # Check existing student by university & matric
        res = self.client.table("students") \
            .select("*") \
            .eq("university_id", university_id) \
            .eq("matric_number", matric_number) \
            .execute()

        if res.data and len(res.data) > 0:
            return res.data[0]

        # Insert new student
        new_student = {
            "university_id": university_id,
            "advisor_id": advisor_id,
            "matric_number": matric_number,
            "full_name": student_name,
            "curriculum_year": curriculum_year,
            "program_code": program_code,
            "academic_status": "Good Standing"
        }
        ins_res = self.client.table("students").insert(new_student).execute()
        return ins_res.data[0] if ins_res.data else new_student

    def persist_audit_results(
        self,
        student_id: str,
        advisor_id: str,
        records: List[CourseAuditResult],
        summary: AuditSummary,
        storage_pdf_path: str
    ) -> str:
        """
        Saves parsed academic records and degree audit snapshot to PostgreSQL.
        Returns audit_id UUID.
        """
        if not self.client:
            return "mock-audit-id"

        # 1. Clear previous records for this student to ensure idempotency
        self.client.table("academic_records").delete().eq("student_id", student_id).execute()

        # 2. Insert new academic records
        records_to_insert = [
            {
                "student_id": student_id,
                "course_code": r.course_code,
                "course_name": r.course_name,
                "credits": r.credits,
                "grade": r.grade,
                "grade_point": r.grade_point,
                "semester": r.semester,
                "status": r.status,
                "prerequisite_met": r.prerequisite_met,
                "missing_prerequisites": r.missing_prerequisites,
                "is_ai_parsed": r.is_ai_parsed,
                "raw_extracted_text": r.raw_extracted_text
            }
            for r in records
        ]
        if records_to_insert:
            self.client.table("academic_records").insert(records_to_insert).execute()

        # 3. Update student CGPA & Credits
        self.client.table("students").update({
            "cgpa": summary.cgpa,
            "total_credits_earned": summary.total_credits_earned,
            "academic_status": "Good Standing" if summary.overall_traffic_light != "RED" else "At-Risk"
        }).eq("id", student_id).execute()

        # 4. Insert degree_audits snapshot
        audit_record = {
            "student_id": student_id,
            "advisor_id": advisor_id,
            "audit_status": "COMPLETED",
            "total_credits_required": summary.total_credits_required,
            "total_credits_earned": summary.total_credits_earned,
            "traffic_light_status": summary.overall_traffic_light,
            "unmet_prerequisites_count": summary.unmet_prerequisites_count,
            "failed_courses_count": summary.failed_courses_count,
            "audit_summary": summary.model_dump(),
            "storage_pdf_path": storage_pdf_path
        }
        audit_res = self.client.table("degree_audits").insert(audit_record).execute()
        return audit_res.data[0]["id"] if audit_res.data else "saved-audit"
