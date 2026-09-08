"""
Smart Academic Assessment System - Supabase Service & Client Integration
"""

from typing import Dict, Any, List, Optional
from supabase import create_client, Client
try:
    from app.core.config import settings
    from app.schemas.audit import CourseAuditResult, AuditSummary
except ImportError:
    from backend.app.core.config import settings
    from backend.app.schemas.audit import CourseAuditResult, AuditSummary


def get_supabase_client() -> Optional[Client]:
    """
    Creates and returns a Supabase client instance using Service Role Key
    or Anon Key from centralized settings.
    """
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    if not url or not key:
        return None
    return create_client(url, key)


class SupabaseService:
    def __init__(self):
        self.client: Optional[Client] = get_supabase_client()
        if not self.client:
            print("[Warning] Supabase URL or Key not configured in environment.")

    def download_transcript_bytes(self, storage_path: str) -> bytes:
        """
        Downloads PDF bytes from private 'transcripts' / 'academic-slips' bucket using Service Role privileges.
        """
        if not self.client:
            raise ValueError("Supabase client is uninitialized.")
        
        # storage_path may be 'transcripts/advisor_id/filename.pdf' or 'academic-slips/filename.pdf'
        clean_path = storage_path.removeprefix("transcripts/").removeprefix("academic-slips/").removeprefix("/")
        bucket = "academic-slips" if "academic-slips" in storage_path else "transcripts"
        
        try:
            res = self.client.storage.from_(bucket).download(clean_path)
            return res
        except Exception:
            # Fallback to alternative bucket if default not found
            fallback_bucket = "transcripts" if bucket == "academic-slips" else "academic-slips"
            return self.client.storage.from_(fallback_bucket).download(clean_path)

    def get_university_course_catalog(self, university_id: str = "") -> Dict[str, Dict[str, Any]]:
        """
        Fetches all courses and prerequisites for a given university.
        Returns dict: course_code -> course_data
        Supports both 'courses' and 'course' table schemas.
        """
        if not self.client:
            return {}
        
        catalog: Dict[str, Dict[str, Any]] = {}
        
        # Try 'courses' table first, fallback to 'course'
        for tbl in ["courses", "course"]:
            try:
                query = self.client.table(tbl).select("*")
                if university_id:
                    try:
                        query = query.eq("university_id", university_id)
                    except Exception:
                        pass
                res = query.execute()
                for row in res.data or []:
                    raw_code = row.get("code") or row.get("course_code") or ""
                    code = raw_code.replace(" ", "").upper()
                    if code:
                        catalog[code] = {
                            "code": code,
                            "name": row.get("name") or row.get("course_name") or "",
                            "credits": row.get("credits") or row.get("credit_hour") or 3,
                            "category": row.get("category") or row.get("course_type") or "Core",
                            "prerequisites": row.get("prerequisites") or {"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}
                        }
                if catalog:
                    break
            except Exception:
                continue
                
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
        
        try:
            res = self.client.table("courses").upsert(
                records,
                on_conflict="university_id,code"
            ).execute()
            return len(res.data) if res.data else len(records)
        except Exception:
            return len(records)

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

        try:
            # Check existing student by matric
            res = self.client.table("students").select("*").eq("matric_number", matric_number).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception:
            try:
                res = self.client.table("students").select("*").eq("matric_no", matric_number).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                pass

        # Insert new student record fallback
        new_student = {
            "university_id": university_id if university_id else None,
            "advisor_id": advisor_id if advisor_id else None,
            "matric_number": matric_number,
            "full_name": student_name,
            "curriculum_year": curriculum_year,
            "program_code": program_code,
            "academic_status": "Good Standing"
        }
        try:
            ins_res = self.client.table("students").insert(new_student).execute()
            return ins_res.data[0] if ins_res.data else new_student
        except Exception:
            return new_student

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

        try:
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
        except Exception as e:
            print(f"[Supabase Persistence Warning] {e}")
            return "saved-audit"
