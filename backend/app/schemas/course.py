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
    university_id: str
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
