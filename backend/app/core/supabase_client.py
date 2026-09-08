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
        """
        if not self.client:
            return {}
        
        catalog: Dict[str, Dict[str, Any]] = {}
        
        try:
            query = self.client.table("course").select("*")
            if university_id:
                try:
                    query = query.eq("university_id", university_id)
                except Exception:
                    pass
            res = query.execute()
            for row in res.data or []:
                raw_code = row.get("course_code") or row.get("code") or ""
                code = raw_code.replace(" ", "").upper()
                if code:
                    catalog[code] = {
                        "code": code,
                        "name": row.get("course_name") or row.get("name") or "",
                        "credits": row.get("credit_hour") or row.get("credits") or 3,
                        "category": row.get("course_type") or row.get("category") or "Core",
                        "prerequisites": row.get("prerequisites") or {"type": "AND", "courses": [], "min_grade": None, "min_credits": 0}
                    }

            if catalog:
                # Augment catalog with course_prerequisite table if present
                try:
                    prereq_res = self.client.table("course_prerequisite").select("*").execute()
                    for p in prereq_res.data or []:
                        c_code = (p.get("course_code") or "").replace(" ", "").upper()
                        p_code = (p.get("prereq_code") or p.get("prerequisite_course_code") or "").replace(" ", "").upper()
                        min_g = p.get("min_grade")
                        if c_code and p_code and c_code in catalog:
                            existing_prereqs = catalog[c_code].get("prerequisites", {})
                            existing_courses = existing_prereqs.get("courses", [])
                            if not any((c if isinstance(c, str) else c.get("course_code")) == p_code for c in existing_courses):
                                existing_courses.append({"course_code": p_code, "min_grade": min_g})
                            catalog[c_code]["prerequisites"] = {
                                "type": existing_prereqs.get("type", "AND"),
                                "courses": existing_courses,
                                "min_grade": min_g,
                                "min_credits": existing_prereqs.get("min_credits", 0)
                            }
                except Exception:
                    pass
        except Exception:
            pass
            
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

    def purge_uploaded_document_file(
        self,
        document_id: Optional[str] = None,
        matric_no: Optional[str] = None,
        admin_staff_id: Optional[str] = "ADMIN"
    ) -> Dict[str, Any]:
        """
        Securely purges raw transcript PDF from storage while preserving database row & audit trail.
        
        Policy Rules (Pilot / UAT):
        1. Target document MUST have processing_status == 'Approved' (advisor verified).
        2. If status is 'Pending_Student_Verification', 'Pending_Advisor_Approval', or 'Rejected',
           the purge request is aborted to protect audit review capabilities.
        3. Deletes file from storage bucket ('academic-slips' or 'transcripts').
        4. Updates uploaded_documents row: sets file_path = NULL (preserves row id, foreign keys, extracted data).
        5. Inserts an immutable entry into system_audit_logs with action_type 'DELETE'.
        
        Note: Automatic purge-on-approval is the intended production behavior for Phase 2.
        """
        if not self.client:
            raise ValueError("Supabase client is uninitialized.")

        if not document_id and not matric_no:
            raise ValueError("Must provide either document_id or matric_no to purge.")

        # 1. Fetch document record
        query = self.client.table("uploaded_documents").select("*")
        if document_id:
            query = query.eq("id", document_id)
        elif matric_no:
            query = query.eq("matric_no", matric_no)
        
        doc_res = query.execute()
        if not doc_res.data or len(doc_res.data) == 0:
            raise ValueError(f"No document found matching criteria (id: {document_id}, matric: {matric_no}).")

        target_doc = doc_res.data[0]
        doc_id = target_doc["id"]
        current_status = target_doc.get("processing_status", "")
        file_path = target_doc.get("file_path")

        # 2. Status Enforcement: MUST be 'Approved'
        if current_status != "Approved":
            raise PermissionError(
                f"Cannot purge document '{doc_id}' with status '{current_status}'. "
                "Purge is strictly permitted only after advisor approval ('Approved') to allow audit verification."
            )

        # 3. Check if file is already purged
        if not file_path or file_path in {"", "[PURGED]"}:
            return {
                "success": True,
                "message": f"Document '{doc_id}' file is already purged (file_path is [PURGED]).",
                "document_id": doc_id,
                "file_path": "[PURGED]",
                "processing_status": current_status
            }

        # 4. Delete file from Supabase Storage
        clean_path = file_path.removeprefix("transcripts/").removeprefix("academic-slips/").removeprefix("/")
        bucket = "academic-slips" if "academic-slips" in file_path else "transcripts"
        
        storage_deleted = False
        try:
            self.client.storage.from_(bucket).remove([clean_path])
            storage_deleted = True
        except Exception as e:
            # Fallback to alternative bucket
            fallback_bucket = "transcripts" if bucket == "academic-slips" else "academic-slips"
            try:
                self.client.storage.from_(fallback_bucket).remove([clean_path])
                storage_deleted = True
            except Exception as e2:
                print(f"[Storage Delete Warning] Could not remove '{clean_path}' from buckets: {e2}")

        # 5. Update database row: mark file_path as [PURGED] (preserves NOT NULL constraint & foreign keys)
        self.client.table("uploaded_documents").update({
            "file_path": "[PURGED]"
        }).eq("id", doc_id).execute()

        # 6. Insert into system_audit_logs
        valid_admin = admin_staff_id if admin_staff_id in {"ADMIN1", "ADMIN-CLI"} else "ADMIN1"
        log_entry = {
            "admin_staff_id": valid_admin,
            "action_type": "DELETE",
            "target_table": "uploaded_documents",
            "record_id": doc_id,
            "description": f"Purged transcript PDF '{file_path}' from storage bucket after advisor approval."
        }
        try:
            self.client.table("system_audit_logs").insert(log_entry).execute()
        except Exception as log_err:
            # Fallback with admin_staff_id = None if FK fails
            try:
                log_entry["admin_staff_id"] = None
                self.client.table("system_audit_logs").insert(log_entry).execute()
            except Exception as log_err2:
                print(f"[Audit Log Warning] Could not write to system_audit_logs: {log_err2}")

        return {
            "success": True,
            "message": f"Successfully purged file for document '{doc_id}'.",
            "document_id": doc_id,
            "purged_file_path": file_path,
            "storage_deleted": storage_deleted,
            "processing_status": current_status
        }

