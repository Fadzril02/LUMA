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
    syllabus_year: str = Form(..., description="Syllabus Year (e.g. 2024/2025)"),
    total_credits: int = Form(..., description="Total required credits for degree template"),
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Parses curriculum CSV and inserts prerequisite rules directly into degree_templates and template_courses.
    Supports complex prerequisites like 'SECJ1013 AND SECJ1023', 'SECJ1013 OR SECD2523', and credit gates.
    """
    if not file.filename or not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a standard CSV file."
        )

    clean_template_name = template_name.strip()
    clean_program_code = program_code.strip().upper()
    clean_syllabus_year = syllabus_year.strip()

    if not clean_template_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Degree template name is required.")
    if not clean_program_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Program code is required.")
    if not clean_syllabus_year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Syllabus year is required.")
    if total_credits <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Total credits must be a positive integer.")

    # 1. Parse CSV first; reject the whole upload if there are any row errors (return them with row numbers)
    try:
        content_bytes = await file.read()
        csv_text = content_bytes.decode('utf-8-sig')  # handles Excel UTF-8 BOM
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read CSV text content: {str(e)}"
        )

    parsed_courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV validation failed: {'; '.join(errors)}"
        )

    if not parsed_courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no valid course rows."
        )

    supabase_svc = SupabaseService()
    
    # 2. Auth + tenant lookup
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

    # 3. Load tenant row (name, default_prereq_min_grade). Fail loud if it's missing.
    tenant_query = supabase_svc.client.table("tenants").select("name, default_prereq_min_grade").eq("id", tenant_id).limit(1).execute()
    if not tenant_query.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tenant configuration '{tenant_id}' not found in tenants table"
        )
    tenant_row = tenant_query.data[0]
    university_name = tenant_row.get("name")
    default_prereq_min_grade = tenant_row.get("default_prereq_min_grade")
    if not university_name or not default_prereq_min_grade:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tenant configuration '{tenant_id}' is missing required fields (name, default_prereq_min_grade)"
        )

    # 4. Check if template already exists (duplicate check)
    existing_tmpl = supabase_svc.client.table("degree_templates").select("id").eq("tenant_id", tenant_id).eq("program_code", clean_program_code).eq("syllabus_year", clean_syllabus_year).limit(1).execute()
    if existing_tmpl.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Template already exists for this program/year"
        )

    # Insert degree_templates (tenant_id, university_name = tenants.name, program_code, program_name = template_name, syllabus_year, total_credits_required)
    tmpl_data = {
        "tenant_id": tenant_id,
        "university_name": university_name,
        "program_code": clean_program_code,
        "program_name": clean_template_name,
        "syllabus_year": clean_syllabus_year,
        "total_credits_required": total_credits,
    }

    try:
        tmpl_res = supabase_svc.client.table("degree_templates").insert(tmpl_data).execute()
    except Exception as e:
        err_msg = str(e).lower()
        if "duplicate" in err_msg or "unique" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template already exists for this program/year"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create degree template: {str(e)}"
        )

    if not tmpl_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create degree template: no record returned"
        )

    template_id = tmpl_res.data[0]["id"]

    # 5. Insert template_courses rows
    course_rows = []
    for c in parsed_courses:
        prereqs = dict(c.get("prerequisites") or {})
        has_custom = prereqs.pop("has_custom_min_grade", False)
        if not has_custom:
            prereqs["min_grade"] = default_prereq_min_grade

        course_rows.append({
            "template_id": template_id,
            "course_code": c["code"],
            "course_name": c["name"],
            "credit_hour": c["credits"],
            "is_core_requirement": (c.get("category") or "").strip().title() == "Core",
            "prerequisites": prereqs,
        })

    try:
        supabase_svc.client.table("template_courses").insert(course_rows).execute()
    except Exception as insert_err:
        # Delete template just created on failure
        try:
            supabase_svc.client.table("degree_templates").delete().eq("id", template_id).execute()
        except Exception as del_err:
            print(f"[Courses] Failed to rollback template {template_id}: {del_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to insert template courses: {str(insert_err)}"
        )

    # 6. Real response
    return CourseCSVUploadResponse(
        template_id=str(template_id),
        university_id=tenant_id,
        total_parsed=len(parsed_courses),
        total_inserted=len(course_rows),
        errors=[],
        courses=course_rows
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
