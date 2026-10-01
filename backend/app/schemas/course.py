"""
[PROJECT_NAME] Course & Curriculum Schemas
Company: [COMPANY_NAME]
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    code: str = Field(..., description="Course code, e.g., 'SECJ1013'")
    name: str = Field(..., description="Course title, e.g., 'Programming Technique I'")
    credits: int = Field(3, ge=1, le=12, description="Credit hours")
    category: str = Field("Core", description="Core, Elective, University Requirement")
    prerequisites: Dict[str, Any] = Field(
        default_factory=lambda: {"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}
    )


class CourseCSVUploadResponse(BaseModel):
    template_id: str
    university_id: Optional[str] = None
    total_parsed: int
    total_inserted: int
    errors: List[str] = []
    courses: List[Dict[str, Any]] = []


class CohortCreate(BaseModel):
    name: str = Field(..., description="e.g. Software Engineering 2025 Intake")
    curriculum_version: str = Field("2023/2024", description="Curriculum revision tag")
    max_students: Optional[int] = 200


class CohortResponse(BaseModel):
    id: str
    advisor_id: str
    university_id: str
    name: str
    invite_code: str
    curriculum_version: str
    is_active: bool
    created_at: str


class TemplateSummaryResponse(BaseModel):
    id: str
    program_code: str
    program_name: str
    syllabus_year: str
    total_credits_required: int
    owner_staff_id: Optional[str] = None
    can_edit: bool


class TemplateDetailResponse(BaseModel):
    id: str
    program_code: str
    program_name: str
    syllabus_year: str
    total_credits_required: int
    owner_staff_id: Optional[str] = None
    can_edit: bool
    rows: List[Dict[str, Any]] = []


class TemplateUpdate(BaseModel):
    program_name: Optional[str] = None
    total_credits_required: Optional[int] = None


class TemplateRowCreate(BaseModel):
    course_code: str
    course_name: str
    credit_hour: Optional[int] = None
    credits: Optional[int] = None
    category: str
    prerequisites: Optional[Any] = ""


class TemplateRowUpdate(BaseModel):
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    credit_hour: Optional[int] = None
    credits: Optional[int] = None
    category: Optional[str] = None
    prerequisites: Optional[Any] = None


class TemplateRowImpactResponse(BaseModel):
    overrides_count: int
    cohorts_using_template: int


class TemplateRowDeleteResponse(BaseModel):
    deleted: bool
    row_id: str
    cascaded_overrides_count: int

