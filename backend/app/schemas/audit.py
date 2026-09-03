"""
[PROJECT_NAME] Audit Schemas
Company: [COMPANY_NAME]
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
