"""
Smart Academic Assessment System - Audit & Ingestion Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class StorageAuditRequest(BaseModel):
    """
    Request model for processing a PDF directly from Supabase Storage.
    Eliminates multipart upload overhead to FastAPI.
    """
    storage_path: str = Field(..., description="Path inside the transcripts bucket, e.g., 'transcripts/{advisor_id}/{filename}'")
    student_id: Optional[str] = Field(None, description="UUID of existing student, or None to auto-create/lookup via matric")
    advisor_id: str = Field(..., description="UUID of authenticated advisor")
    university_id: str = Field(..., description="UUID of the university")
    matric_number: Optional[str] = Field(None, description="Student matric number if known upfront")
    curriculum_year: Optional[str] = Field("2023/2024", description="Curriculum intake year")
    program_code: Optional[str] = Field("SECJ", description="Program code, e.g. SECJ")


class ExtractPDFRequest(BaseModel):
    file_path: str = Field(..., description="Path in Supabase storage bucket, e.g. 'slips/matric_timestamp.pdf'")


class ExtractPDFResponse(BaseModel):
    success: bool
    data: Dict[str, Any]


class ParsedLineItem(BaseModel):
    course_code: str
    course_name: str
    credits: int
    grade: str
    grade_point: float
    semester: str
    status: str  # 'Passed', 'Failed', 'Exempted', 'In-Progress'
    is_ai_parsed: bool = False
    raw_extracted_text: Optional[str] = None


class CourseAuditResult(BaseModel):
    course_code: str
    course_name: str
    credits: int
    grade: str
    grade_point: float
    semester: str
    status: str
    domain: str = "Core Development"  # Logic & Math, Core Development, Systems & Architecture, Soft Skills, Project Management
    traffic_light: str  # 'GREEN', 'YELLOW', 'RED'
    prerequisite_met: bool
    missing_prerequisites: List[str] = []
    is_ai_parsed: bool = False
    raw_extracted_text: Optional[str] = None


class AuditSummary(BaseModel):
    total_credits_required: int = 130
    total_credits_earned: int = 0
    cgpa: float = 0.00
    overall_traffic_light: str = "GREEN"  # 'GREEN', 'YELLOW', 'RED'
    passed_courses_count: int = 0
    failed_courses_count: int = 0
    in_progress_courses_count: int = 0
    unmet_prerequisites_count: int = 0
    academic_standing: str = "Good Standing"
    ai_fallback_used: bool = False
    radar_stats: Dict[str, float] = Field(
        default_factory=lambda: {
            "Logic & Math": 0.0,
            "Core Development": 0.0,
            "Systems & Architecture": 0.0,
            "Soft Skills": 0.0,
            "Project Management": 0.0,
        }
    )


class DegreeAuditResponse(BaseModel):
    audit_id: Optional[str] = None
    student_id: str
    matric_number: str
    student_name: str
    university_id: str
    advisor_id: str
    summary: AuditSummary
    records: List[CourseAuditResult]
    unparsed_lines: List[str] = []


class ExtractedCourseItem(BaseModel):
    course_code: str
    course_name: Optional[str] = "Course"
    grade: str
    credit_hour: Optional[int] = 3
    credits: Optional[int] = None
    status: Optional[str] = "Pass"
    session_semester: Optional[str] = None


class FinalizeApprovalRequest(BaseModel):
    document_id: str = Field(..., description="UUID of document in uploaded_documents table")
    matric_number: str = Field(..., description="Student matric number")
    student_name: Optional[str] = None
    advisor_id: Optional[str] = "STAFF-LIYANA"
    university_id: Optional[str] = ""
    curriculum_year: Optional[str] = "2023/2024"
    program_code: Optional[str] = "SECJ"
    academic_session: Optional[str] = "2024/2025"
    semester: Optional[Any] = 1
    courses: List[ExtractedCourseItem] = []


class FinalizeApprovalResponse(BaseModel):
    success: bool
    audit_id: str
    document_id: str
    matric_number: str
    student_name: str
    summary: AuditSummary
    records_saved_count: int
    processing_status: str = "Approved"
    records: List[CourseAuditResult]


class PurgeDocumentRequest(BaseModel):
    document_id: Optional[str] = Field(None, description="UUID of target uploaded document")
    matric_no: Optional[str] = Field(None, description="Student matric number")
    admin_staff_id: Optional[str] = Field("ADMIN", description="Staff ID of administrator triggering the purge")


class PurgeDocumentResponse(BaseModel):
    success: bool
    message: str
    document_id: str
    purged_file_path: Optional[str] = None
    storage_deleted: bool = False
    processing_status: str
