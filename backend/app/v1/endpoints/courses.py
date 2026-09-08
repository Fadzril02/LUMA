"""
Smart Academic Assessment System - Course Catalog & Ingestion Endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from fastapi.responses import PlainTextResponse
from typing import Optional
try:
    from app.schemas.course import CourseCSVUploadResponse
    from app.engine.parsers.csv_course_parser import CSVCourseParser
    from app.core.supabase_client import SupabaseService
except ImportError:
    from backend.app.schemas.course import CourseCSVUploadResponse
    from backend.app.engine.parsers.csv_course_parser import CSVCourseParser
    from backend.app.core.supabase_client import SupabaseService

router = APIRouter(prefix="/courses", tags=["Course Catalog"])
supabase_svc = SupabaseService()

SAMPLE_CSV_TEMPLATE = """course_code,course_name,credits,category,prerequisites
SECJ1013,Programming Technique I,3,Core,None
SECP1513,Discrete Structure,3,Core,None
SECR1013,Digital Logic,3,Core,None
SECJ1023,Programming Technique II,3,Core,SECJ1013
SECJ2013,Data Structures and Algorithms,3,Core,SECJ1023
SECJ2203,Software Engineering,3,Core,SECJ1023
SECV2223,Web Programming,3,Core,SECJ1013 OR SECD2523
SECJ3032,Final Year Project 1,2,Core,SECJ2203 AND SECJ2013 min_credits: 80
SECJ4044,Final Year Project 2,4,Core,SECJ3032 min_credits: 90
"""


@router.post(
    "/upload-csv",
    response_model=CourseCSVUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload curriculum course structure via CSV"
)
async def upload_courses_csv(
    file: UploadFile = File(..., description="CSV file containing curriculum definitions"),
    university_id: str = Form(..., description="Target University UUID")
):
    """
    Parses curriculum CSV and inserts prerequisite rules directly into the university catalog.
    Supports complex prerequisites like 'SECJ1013 AND SECJ1023', 'SECJ1013 OR SECD2523', and credit gates.
    """
    if not file.filename or not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a standard CSV file."
        )

    try:
        content_bytes = await file.read()
        csv_text = content_bytes.decode('utf-8-sig')  # handles Excel UTF-8 BOM
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read CSV text content: {str(e)}"
        )

    parsed_courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    if not parsed_courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No valid courses could be parsed. Errors: {'; '.join(errors)}"
        )

    # Bulk upsert into Supabase courses table
    inserted_count = supabase_svc.upsert_courses_bulk(university_id, parsed_courses)

    return CourseCSVUploadResponse(
        university_id=university_id,
        total_parsed=len(parsed_courses),
        total_inserted=inserted_count,
        errors=errors,
        courses=parsed_courses
    )


@router.get(
    "/template-csv",
    response_class=PlainTextResponse,
    summary="Download sample CSV template for curriculum course structures"
)
async def get_csv_template():
    """
    Returns a ready-to-use CSV template for lecturers/admins to populate course codes and prerequisites.
    """
    return PlainTextResponse(
        content=SAMPLE_CSV_TEMPLATE,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=course_curriculum_template.csv"}
    )
