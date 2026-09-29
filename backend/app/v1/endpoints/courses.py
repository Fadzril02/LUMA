"""
Smart Academic Assessment System - Course Catalog & Ingestion Endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.responses import PlainTextResponse
# No typing import needed here anymore
try:
    from app.schemas.course import CourseCSVUploadResponse
    from app.engine.parsers.csv_course_parser import CSVCourseParser
    from app.core.supabase_client import SupabaseService
    from app.core.auth import verify_advisor_jwt
except ImportError:
    from backend.app.schemas.course import CourseCSVUploadResponse
    from backend.app.engine.parsers.csv_course_parser import CSVCourseParser
    from backend.app.core.supabase_client import SupabaseService
    from backend.app.core.auth import verify_advisor_jwt

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
    template_name: str = Form(..., description="Degree template display name"),
    program_code: str = Form(..., description="Program Code (e.g. SECJ)"),
    total_credits: int = Form(..., description="Total required credits for degree template"),
    jwt_payload: dict = Depends(verify_advisor_jwt)
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

    supabase_svc = SupabaseService()
    
    jwt_sub = jwt_payload.get("sub")
    if not jwt_sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject (sub)")

    adv_query = supabase_svc.client.table("advisors").select("tenant_id").eq("user_id", jwt_sub).limit(1).execute()
    if not adv_query.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No advisor profile found for this user")
            
    advisor_row = adv_query.data[0]
    tenant_id = advisor_row.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Advisor profile is missing a tenant_id configuration")

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

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Curriculum storage pending tenant-scoped schema"
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
