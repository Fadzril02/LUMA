"""
Smart Academic Assessment System - Course Catalog & Ingestion Endpoints
"""

from typing import List, Dict, Any, Tuple, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.responses import PlainTextResponse

try:
    from app.schemas.course import (
        CourseCSVUploadResponse,
        TemplateSummaryResponse,
        TemplateDetailResponse,
        TemplateUpdate,
        TemplateRowCreate,
        TemplateRowUpdate,
        TemplateRowImpactResponse,
        TemplateRowDeleteResponse,
    )
    from app.engine.parsers.csv_course_parser import CSVCourseParser
    from app.core.supabase_client import SupabaseService
    from app.core.auth import verify_advisor_jwt
except ImportError:
    from backend.app.schemas.course import (
        CourseCSVUploadResponse,
        TemplateSummaryResponse,
        TemplateDetailResponse,
        TemplateUpdate,
        TemplateRowCreate,
        TemplateRowUpdate,
        TemplateRowImpactResponse,
        TemplateRowDeleteResponse,
    )
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


def _get_advisor_and_tenant(svc: SupabaseService, jwt_payload: dict) -> Tuple[str, str]:
    """Helper to authenticate advisor and retrieve tenant_id and staff_id from DB."""
    jwt_sub = jwt_payload.get("sub")
    if not jwt_sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject (sub)")

    adv_query = svc.client.table("advisors").select("tenant_id, staff_id").eq("user_id", jwt_sub).limit(1).execute()
    if not adv_query.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No advisor profile found for this user")

    advisor_row = adv_query.data[0]
    tenant_id = advisor_row.get("tenant_id")
    staff_id = advisor_row.get("staff_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Advisor profile is missing a tenant_id configuration")
    if not staff_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Advisor profile is missing a staff_id configuration")
    return tenant_id, staff_id


def _verify_template_write_access(svc: SupabaseService, template_id: str, tenant_id: str, staff_id: str) -> dict:
    """
    Enforces write permissions:
    1. Template exists
    2. template.tenant_id == my tenant
    3. owner_staff_id is not NULL (else 403 "Template has no owner; contact support")
    4. owner_staff_id == my staff_id (else 403 "Only the uploader can edit this template")
    """
    tmpl_query = svc.client.table("degree_templates").select("*").eq("id", template_id).limit(1).execute()
    if not tmpl_query.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Degree template not found")
    tmpl = tmpl_query.data[0]
    if tmpl.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: template belongs to another institution")
    owner_staff_id = tmpl.get("owner_staff_id")
    if owner_staff_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Template has no owner; contact support")
    if owner_staff_id != staff_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the uploader can edit this template")
    return tmpl


def _renumber_template_slots(svc: SupabaseService, template_id: str):
    """
    Renumbers slot_no (1..n) for all elective slots in the template.
    Preserves ordering based on existing slot_no, created_at, or id.
    """
    rows_query = svc.client.table("template_courses")\
        .select("id, slot_no, created_at, course_code")\
        .eq("template_id", template_id)\
        .eq("is_elective_slot", True)\
        .execute()
    slot_rows = rows_query.data or []
    slot_rows.sort(key=lambda r: (
        r.get("slot_no") if r.get("slot_no") is not None else 999999,
        r.get("created_at") or "",
        str(r.get("id"))
    ))
    for idx, r in enumerate(slot_rows, start=1):
        if r.get("slot_no") != idx:
            svc.client.table("template_courses").update({"slot_no": idx}).eq("id", r["id"]).execute()


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
    Sets owner_staff_id from the caller's advisor row (JWT -> advisors.staff_id). Never from the body.
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

    svc = SupabaseService()
    
    # 2. Auth + advisor lookup (tenant_id and staff_id)
    jwt_sub = jwt_payload.get("sub")
    if not jwt_sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject (sub)")

    adv_query = svc.client.table("advisors").select("tenant_id, staff_id").eq("user_id", jwt_sub).limit(1).execute()
    if not adv_query.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No advisor profile found for this user")
            
    advisor_row = adv_query.data[0]
    tenant_id = advisor_row.get("tenant_id")
    owner_staff_id = advisor_row.get("staff_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Advisor profile is missing a tenant_id configuration")

    # 3. Load tenant row (name, default_prereq_min_grade). Fail loud if it's missing.
    tenant_query = svc.client.table("tenants").select("name, default_prereq_min_grade").eq("id", tenant_id).limit(1).execute()
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
    existing_tmpl = svc.client.table("degree_templates").select("id").eq("tenant_id", tenant_id).eq("program_code", clean_program_code).eq("syllabus_year", clean_syllabus_year).limit(1).execute()
    if existing_tmpl.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Template already exists for this program/year"
        )

    # Insert degree_templates (with owner_staff_id from advisor row)
    tmpl_data = {
        "tenant_id": tenant_id,
        "university_name": university_name,
        "program_code": clean_program_code,
        "program_name": clean_template_name,
        "syllabus_year": clean_syllabus_year,
        "total_credits_required": total_credits,
        "owner_staff_id": owner_staff_id,
    }

    try:
        tmpl_res = svc.client.table("degree_templates").insert(tmpl_data).execute()
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
            "category": c["category"],
            "is_elective_slot": c.get("is_elective_slot", False),
            "slot_no": c.get("slot_no"),
            "match_patterns": c.get("match_patterns"),
            "prerequisites": prereqs,
        })

    try:
        svc.client.table("template_courses").insert(course_rows).execute()
    except Exception as insert_err:
        # Delete template just created on failure
        try:
            svc.client.table("degree_templates").delete().eq("id", template_id).execute()
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
    "/templates",
    response_model=List[TemplateSummaryResponse],
    summary="List curriculum templates in advisor's tenant"
)
async def list_templates(
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Returns templates in the advisor's tenant:
    {id, program_code, program_name, syllabus_year, total_credits_required, owner_staff_id, can_edit}
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)

    query = svc.client.table("degree_templates")\
        .select("id, program_code, program_name, syllabus_year, total_credits_required, owner_staff_id")\
        .eq("tenant_id", tenant_id)\
        .order("program_code", desc=False)\
        .order("syllabus_year", desc=True)\
        .execute()

    results = []
    for tmpl in (query.data or []):
        owner = tmpl.get("owner_staff_id")
        can_edit = bool(owner and owner == staff_id)
        results.append(TemplateSummaryResponse(
            id=str(tmpl["id"]),
            program_code=tmpl.get("program_code", ""),
            program_name=tmpl.get("program_name", ""),
            syllabus_year=tmpl.get("syllabus_year", ""),
            total_credits_required=int(tmpl.get("total_credits_required") or 0),
            owner_staff_id=owner,
            can_edit=can_edit
        ))
    return results


@router.get(
    "/templates/{id}",
    response_model=TemplateDetailResponse,
    summary="Get curriculum template and its courses"
)
async def get_template_detail(
    id: str,
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Returns template + course rows for a given template within advisor's tenant.
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)

    tmpl_query = svc.client.table("degree_templates").select("*").eq("id", id).limit(1).execute()
    if not tmpl_query.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Degree template not found")
    tmpl = tmpl_query.data[0]
    if tmpl.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: template belongs to another institution")

    owner = tmpl.get("owner_staff_id")
    can_edit = bool(owner and owner == staff_id)

    rows_query = svc.client.table("template_courses").select("*").eq("template_id", id).execute()
    rows = rows_query.data or []

    def _row_sort_key(r):
        is_slot = bool(r.get("is_elective_slot"))
        slot_no = r.get("slot_no") if r.get("slot_no") is not None else 999999
        code = r.get("course_code") or ""
        return (1 if is_slot else 0, slot_no if is_slot else 0, code)

    rows.sort(key=_row_sort_key)

    return TemplateDetailResponse(
        id=str(tmpl["id"]),
        program_code=tmpl.get("program_code", ""),
        program_name=tmpl.get("program_name", ""),
        syllabus_year=tmpl.get("syllabus_year", ""),
        total_credits_required=int(tmpl.get("total_credits_required") or 0),
        owner_staff_id=owner,
        can_edit=can_edit,
        rows=rows
    )


@router.patch(
    "/templates/{id}",
    summary="Update curriculum template metadata"
)
async def update_template(
    id: str,
    payload: TemplateUpdate,
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Updates program_name and/or total_credits_required for a template.
    Requires template owner in same tenant.
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)
    _verify_template_write_access(svc, id, tenant_id, staff_id)

    updates = {}
    if payload.program_name is not None:
        clean_name = payload.program_name.strip()
        if not clean_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Program name cannot be empty")
        updates["program_name"] = clean_name
    if payload.total_credits_required is not None:
        if payload.total_credits_required <= 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Total credits required must be positive")
        updates["total_credits_required"] = payload.total_credits_required

    if updates:
        res = svc.client.table("degree_templates").update(updates).eq("id", id).execute()
        if res.data:
            return res.data[0]

    tmpl_res = svc.client.table("degree_templates").select("*").eq("id", id).limit(1).execute()
    return tmpl_res.data[0] if tmpl_res.data else {}


@router.post(
    "/templates/{id}/rows",
    status_code=status.HTTP_201_CREATED,
    summary="Add a course or elective slot row to template"
)
async def add_template_row(
    id: str,
    payload: TemplateRowCreate,
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Adds a new course or slot row to the template.
    Validates row via shared CSVCourseParser.validate_course_row.
    Renumbers slot_no if elective slot.
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)
    _verify_template_write_access(svc, id, tenant_id, staff_id)

    # 1. Fetch tenant default min grade
    tenant_query = svc.client.table("tenants").select("default_prereq_min_grade").eq("id", tenant_id).limit(1).execute()
    default_min_grade = "C"
    if tenant_query.data and tenant_query.data[0].get("default_prereq_min_grade"):
        default_min_grade = tenant_query.data[0]["default_prereq_min_grade"]

    # 2. Existing real course codes in template
    existing_rows = svc.client.table("template_courses").select("course_code, is_elective_slot").eq("template_id", id).execute()
    existing_real_codes = {r["course_code"] for r in (existing_rows.data or []) if not r.get("is_elective_slot")}

    credits_val = payload.credit_hour if payload.credit_hour is not None else payload.credits
    course_data, errors = CSVCourseParser.validate_course_row(
        code=payload.course_code,
        name=payload.course_name,
        credits=credits_val,
        category=payload.category,
        prerequisites=payload.prerequisites,
        existing_real_codes=existing_real_codes,
    )
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="; ".join(errors)
        )

    prereqs = dict(course_data["prerequisites"] or {})
    has_custom = prereqs.pop("has_custom_min_grade", False)
    if not has_custom and "min_grade" not in prereqs:
        prereqs["min_grade"] = default_min_grade

    new_row = {
        "template_id": id,
        "course_code": course_data["code"],
        "course_name": course_data["name"],
        "credit_hour": course_data["credits"],
        "is_core_requirement": course_data["category"] == "Core",
        "category": course_data["category"],
        "is_elective_slot": course_data["is_elective_slot"],
        "match_patterns": course_data["match_patterns"],
        "prerequisites": prereqs,
    }

    insert_res = svc.client.table("template_courses").insert(new_row).execute()
    if not insert_res.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to insert template course row")

    inserted_row = insert_res.data[0]

    # Renumber slots after adding a row
    if course_data["is_elective_slot"]:
        _renumber_template_slots(svc, id)

    fresh_row_query = svc.client.table("template_courses").select("*").eq("id", inserted_row["id"]).limit(1).execute()
    return fresh_row_query.data[0] if fresh_row_query.data else inserted_row


@router.patch(
    "/templates/{id}/rows/{row_id}",
    summary="Edit a course or elective slot row in template"
)
async def update_template_row(
    id: str,
    row_id: str,
    payload: TemplateRowUpdate,
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Edits a row in the template. Reuses CSVCourseParser.validate_course_row.
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)
    _verify_template_write_access(svc, id, tenant_id, staff_id)

    row_query = svc.client.table("template_courses").select("*").eq("id", row_id).eq("template_id", id).limit(1).execute()
    if not row_query.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template course row not found")
    existing_row = row_query.data[0]

    tenant_query = svc.client.table("tenants").select("default_prereq_min_grade").eq("id", tenant_id).limit(1).execute()
    default_min_grade = "C"
    if tenant_query.data and tenant_query.data[0].get("default_prereq_min_grade"):
        default_min_grade = tenant_query.data[0]["default_prereq_min_grade"]

    all_rows = svc.client.table("template_courses").select("id, course_code, is_elective_slot").eq("template_id", id).execute()
    existing_real_codes = {
        r["course_code"] for r in (all_rows.data or [])
        if not r.get("is_elective_slot") and str(r.get("id")) != str(row_id)
    }

    code = payload.course_code if payload.course_code is not None else existing_row["course_code"]
    name = payload.course_name if payload.course_name is not None else existing_row["course_name"]
    credits_val = payload.credit_hour if payload.credit_hour is not None else (
        payload.credits if payload.credits is not None else existing_row["credit_hour"]
    )
    category = payload.category if payload.category is not None else existing_row["category"]
    prereqs_val = payload.prerequisites if payload.prerequisites is not None else existing_row.get("prerequisites")

    course_data, errors = CSVCourseParser.validate_course_row(
        code=code,
        name=name,
        credits=credits_val,
        category=category,
        prerequisites=prereqs_val,
        existing_real_codes=existing_real_codes,
    )
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="; ".join(errors)
        )

    prereqs = dict(course_data["prerequisites"] or {})
    has_custom = prereqs.pop("has_custom_min_grade", False)
    if not has_custom and "min_grade" not in prereqs:
        prereqs["min_grade"] = default_min_grade

    was_slot = existing_row.get("is_elective_slot", False)
    is_slot = course_data["is_elective_slot"]

    update_data = {
        "course_code": course_data["code"],
        "course_name": course_data["name"],
        "credit_hour": course_data["credits"],
        "is_core_requirement": course_data["category"] == "Core",
        "category": course_data["category"],
        "is_elective_slot": is_slot,
        "match_patterns": course_data["match_patterns"],
        "prerequisites": prereqs,
        "updated_at": "now()",
    }
    if not is_slot:
        update_data["slot_no"] = None

    up_res = svc.client.table("template_courses").update(update_data).eq("id", row_id).execute()
    if not up_res.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update template course row")

    if was_slot or is_slot:
        _renumber_template_slots(svc, id)

    fresh_row_query = svc.client.table("template_courses").select("*").eq("id", row_id).limit(1).execute()
    return fresh_row_query.data[0] if fresh_row_query.data else up_res.data[0]


@router.delete(
    "/templates/{id}/rows/{row_id}",
    response_model=TemplateRowDeleteResponse,
    summary="Delete a course row or elective slot from template"
)
async def delete_template_row(
    id: str,
    row_id: str,
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Deletes a template course row.
    Cascades linked elective_assignments and returns how many were removed.
    Renumbers slot_no (1..n) after deletion.
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)
    _verify_template_write_access(svc, id, tenant_id, staff_id)

    row_query = svc.client.table("template_courses").select("id, is_elective_slot").eq("id", row_id).eq("template_id", id).limit(1).execute()
    if not row_query.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template course row not found")
    existing_row = row_query.data[0]

    # Count linked elective assignments
    overrides_query = svc.client.table("elective_assignments").select("id").eq("template_course_id", row_id).execute()
    cascaded_count = len(overrides_query.data or [])

    if cascaded_count > 0:
        svc.client.table("elective_assignments").delete().eq("template_course_id", row_id).execute()

    svc.client.table("template_courses").delete().eq("id", row_id).execute()

    if existing_row.get("is_elective_slot"):
        _renumber_template_slots(svc, id)

    return TemplateRowDeleteResponse(
        deleted=True,
        row_id=str(row_id),
        cascaded_overrides_count=cascaded_count
    )


@router.get(
    "/templates/{id}/rows/{row_id}/impact",
    response_model=TemplateRowImpactResponse,
    summary="Calculate impact before deleting a template course row"
)
async def get_template_row_impact(
    id: str,
    row_id: str,
    jwt_payload: dict = Depends(verify_advisor_jwt)
):
    """
    Returns impact counts for a row before deletion:
    {overrides_count, cohorts_using_template}
    """
    svc = SupabaseService()
    tenant_id, staff_id = _get_advisor_and_tenant(svc, jwt_payload)

    # Verify template exists in tenant
    tmpl_query = svc.client.table("degree_templates").select("id, tenant_id").eq("id", id).limit(1).execute()
    if not tmpl_query.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Degree template not found")
    if tmpl_query.data[0].get("tenant_id") != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: template belongs to another institution")

    # Verify row belongs to template
    row_query = svc.client.table("template_courses").select("id").eq("id", row_id).eq("template_id", id).limit(1).execute()
    if not row_query.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template course row not found")

    overrides_query = svc.client.table("elective_assignments").select("id").eq("template_course_id", row_id).execute()
    overrides_count = len(overrides_query.data or [])

    cohorts_query = svc.client.table("cohorts").select("id").eq("template_id", id).execute()
    cohorts_count = len(cohorts_query.data or [])

    return TemplateRowImpactResponse(
        overrides_count=overrides_count,
        cohorts_using_template=cohorts_count
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
