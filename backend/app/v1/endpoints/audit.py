"""
Smart Academic Assessment System - Degree Audit Processing Endpoints
"""

import uuid
import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any, List, Optional

try:
    from app.schemas.audit import (
        StorageAuditRequest,
        TranscriptProcessRequest,
        DegreeAuditResponse,
        AuditSummary,
        CourseAuditResult,
        PurgeDocumentRequest,
        PurgeDocumentResponse,
        FinalizeApprovalRequest,
        AuditApprovalRequest,
        FinalizeApprovalResponse,
        ExtractPDFRequest,
        ExtractPDFResponse,
        ParsedLineItem,
        RejectDocumentRequest,
        SubmitVerificationRequest,
        RejectDocumentResponse
    )
    from app.engine.extractor import PDFExtractor
    from app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
    from app.engine.grading import load_scale, GradingScale, normalize_semester
    from app.engine.graph_resolver import PrerequisiteGraphResolver
    from app.engine.llm_fallback import MicroLLMFallback
    from app.core.supabase_client import SupabaseService
    from app.core.auth import verify_advisor_jwt
except ImportError:
    from backend.app.schemas.audit import (
        StorageAuditRequest,
        TranscriptProcessRequest,
        DegreeAuditResponse,
        AuditSummary,
        CourseAuditResult,
        PurgeDocumentRequest,
        PurgeDocumentResponse,
        FinalizeApprovalRequest,
        AuditApprovalRequest,
        FinalizeApprovalResponse,
        ExtractPDFRequest,
        ExtractPDFResponse,
        ParsedLineItem,
        RejectDocumentRequest,
        SubmitVerificationRequest,
        RejectDocumentResponse
    )
    from backend.app.engine.extractor import PDFExtractor
    from backend.app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
    from backend.app.engine.grading import load_scale, GradingScale, normalize_semester
    from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
    from backend.app.engine.llm_fallback import MicroLLMFallback
    from backend.app.core.supabase_client import SupabaseService
    from backend.app.core.auth import verify_advisor_jwt

router = APIRouter(prefix="/audit", tags=["Degree Audit"])
supabase_svc = SupabaseService()


def _load_authorized_document(
    jwt_payload: dict,
    *,
    file_path: Optional[str] = None,
    document_id: Optional[str] = None,
    allow_student: bool = True,
    allow_advisor: bool = True,
    expected_matric: Optional[str] = None,
):
    """
    Load an uploaded_documents row and verify the caller may act on it.
    Student: owns the matric (students.user_id = JWT sub).
    Advisor: is the student's assigned advisor in the same tenant.
    Returns (doc, role). Raises 401/403/404 (fail loud, never guess).
    """
    jwt_sub = jwt_payload.get("sub")
    if not jwt_sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject (sub)")
    if not supabase_svc.client:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database client unavailable")
    if not file_path and not document_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_path or document_id is required")

    q = supabase_svc.client.table("uploaded_documents").select(
        "id, matric_no, file_path, processing_status, extracted_data, fraud_flag"
    )
    q = q.eq("id", document_id) if document_id else q.eq("file_path", file_path)
    res = q.limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    doc = res.data[0]

    if expected_matric and expected_matric.strip().upper() != str(doc.get("matric_no") or "").strip().upper():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="matric_number does not match the document",
        )

    stu = (
        supabase_svc.client.table("students")
        .select("user_id, advisor_staff_id, tenant_id")
        .eq("matric_no", doc["matric_no"])
        .limit(1)
        .execute()
    )
    if not stu.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this document")
    student = stu.data[0]

    if allow_student and student.get("user_id") == jwt_sub:
        return doc, "student"

    if allow_advisor:
        adv = (
            supabase_svc.client.table("advisors")
            .select("staff_id, tenant_id")
            .eq("user_id", jwt_sub)
            .limit(1)
            .execute()
        )
        if (
            adv.data
            and adv.data[0].get("staff_id") == student.get("advisor_staff_id")
            and adv.data[0].get("tenant_id") == student.get("tenant_id")
        ):
            return doc, "advisor"

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this document")


def _mark_document_failed(document_id: str, message: str) -> None:
    """Record an extraction failure server-side (students can no longer write this)."""
    try:
        supabase_svc.client.table("uploaded_documents").update({
            "processing_status": "Extraction_Failed",
            "processing_error": (message or "Extraction failed")[:500],
        }).eq("id", document_id).execute()
    except Exception as e:
        print(f"[Extract] Failed to mark document {document_id} as Extraction_Failed: {e}")
llm_fallback = MicroLLMFallback()

def fetch_and_merge_historical_records(matric_no: str, new_records: List[ParsedLineItem], tenant_id: str) -> List[ParsedLineItem]:
    if not supabase_svc.client or not matric_no:
        return new_records
    try:
        # MULTI-TENANT: scope fetch to (tenant_id, matric_no) so we never
        # cross tenant boundaries when pulling the cumulative history.
        res = (
            supabase_svc.client
            .table("academic_records")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("matric_no", matric_no)
            .execute()
        )
        existing = res.data or []
    except Exception as e:
        print(f"[Merge Historical] Error fetching historical records: {e}")
        existing = []

    # Map of incoming records: (clean_course_code, normalized_semester)
    new_keys = set()
    for nr in new_records:
        c_code = nr.course_code.replace(" ", "").upper()
        c_sem = normalize_semester(nr.semester) if nr.semester else ""
        if c_code and c_sem:
            new_keys.add((c_code, c_sem))

    merged = []
    for r in existing:
        ex_code = (r.get("course_code") or "").replace(" ", "").upper()
        raw_sem = r.get("semester")
        ex_sem = normalize_semester(raw_sem) if raw_sem else ""
        # Keep existing row unless an incoming new record matches on (course_code, normalised semester)
        if (ex_code, ex_sem) not in new_keys:
            merged.append(ParsedLineItem(
                course_code=r.get("course_code"),
                course_name=r.get("course_name") or r.get("course_code"),
                credits=r.get("credits") or 3,
                grade=r.get("grade"),
                grade_point=float(r.get("grade_point") or 0.0),
                semester=ex_sem or raw_sem,
                status=r.get("status"),
                warning=r.get("warning"),
                is_ai_parsed=r.get("is_ai_parsed", False),
                raw_extracted_text=r.get("raw_extracted_text", "")
            ))
    return merged + new_records


def _extract_advisor_id(jwt_payload: dict) -> str:
    """
    Extract advisor staff_id server-side strictly from verified JWT app_metadata
    or by querying the advisors table using the verified sub claim.
    Completely removes all references to user_metadata or unverified payload.
    Hard-fails with 403 Forbidden if not securely verified.
    """
    app_metadata = jwt_payload.get("app_metadata") or {}
    advisor_id = app_metadata.get("staff_id") or app_metadata.get("advisor_id")
    if advisor_id and str(advisor_id).strip():
        return str(advisor_id).strip()

    jwt_sub = jwt_payload.get("sub")
    if supabase_svc.client and jwt_sub:
        try:
            res = (
                supabase_svc.client.table("advisors")
                .select("staff_id")
                .eq("user_id", jwt_sub)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0 and res.data[0].get("staff_id"):
                return str(res.data[0]["staff_id"]).strip()
        except Exception as e:
            print(f"[_extract_advisor_id] Advisor staff_id lookup error: {e}")

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Unauthorized: Advisor identity cannot be securely verified."
    )


def _check_advisor_identity(jwt_payload: dict, claimed_advisor_id: str) -> str:
    """
    Cross-reference the verified JWT advisor identity against the advisor_id
    claimed in the request body.
    """
    actual_staff_id = _extract_advisor_id(jwt_payload)
    if actual_staff_id != claimed_advisor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"JWT identity (staff_id='{actual_staff_id}') does not match "
                f"the claimed advisor_id='{claimed_advisor_id}' in the request body."
            ),
        )
    return actual_staff_id


UTM_SEEDED_UUID = "00000000-0000-0000-0000-000000000001"


def _resolve_university_code(university_id_or_code: str) -> Optional[str]:
    """
    Resolves raw tenant_id or university_id into an institutional code string (e.g. 'UTM').
    - If the value is a known institution code or alphanumeric short code, returns it directly.
    - If it is a UUID:
      * If it matches the seeded UTM UUID ('00000000-0000-0000-0000-000000000001'), returns 'UTM'.
      * Otherwise queries 'universities' table (select code from universities where id = university_id)
        to resolve the actual institution code.
      * Falls back to 'UTM' if the resolved code is empty or lookup fails.
    """
    raw_val = str(university_id_or_code).strip()
    if not raw_val:
        return None

    is_uuid = False
    try:
        uuid.UUID(raw_val)
        is_uuid = True
    except (ValueError, AttributeError, TypeError):
        is_uuid = False

    if not is_uuid:
        return raw_val

    if raw_val.lower() == UTM_SEEDED_UUID.lower():
        return "UTM"

    if supabase_svc.client:
        try:
            res = (
                supabase_svc.client.table("universities")
                .select("code")
                .eq("id", raw_val)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0 and res.data[0].get("code"):
                resolved_code = str(res.data[0]["code"]).strip()
                if resolved_code:
                    return resolved_code
        except Exception as e:
            print(f"[_resolve_university_code] University code lookup error: {e}")

    return None


def _extract_tenant_id(jwt_payload: dict) -> str:
    """
    Extract tenant_id server-side strictly from verified JWT app_metadata
    or by querying the advisors table using the verified sub claim.
    Resolves UUIDs to institutional codes (e.g. 'UTM') via the universities table.
    Completely removes all references to user_metadata or unverified payload.
    Hard-fails with 403 Forbidden if not securely verified.
    """
    app_metadata = jwt_payload.get("app_metadata") or {}
    tenant_val = app_metadata.get("tenant_id") or app_metadata.get("university_id")
    if tenant_val and str(tenant_val).strip():
        resolved = _resolve_university_code(str(tenant_val).strip())
        if resolved:
            return resolved

    jwt_sub = jwt_payload.get("sub")
    if supabase_svc.client and jwt_sub:
        try:
            res = (
                supabase_svc.client.table("advisors")
                .select("tenant_id")
                .eq("user_id", jwt_sub)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0 and res.data[0].get("tenant_id"):
                raw_tenant = str(res.data[0]["tenant_id"]).strip()
                resolved = _resolve_university_code(raw_tenant)
                if resolved or raw_tenant:
                    return resolved or raw_tenant
        except Exception as e:
            print(f"[_extract_tenant_id] Advisor tenant_id lookup error: {e}")

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Unauthorized: Tenant ID cannot be securely verified."
    )


@router.post(
    "/extract",
    response_model=ExtractPDFResponse,
    status_code=status.HTTP_200_OK,
    summary="Extracts course grades and metadata from a transcript PDF in storage"
)
async def extract_transcript_from_storage(
    request: ExtractPDFRequest,
    jwt_payload: dict = Depends(verify_advisor_jwt),
):
    """
    Zero-Waste Fast Extraction:
    1. Downloads PDF from Supabase storage ('academic-slips' / 'transcripts').
    2. Inspects PDF metadata for suspicious editing software (fraud detection).
    3. Runs in-memory PyMuPDF text extraction (<50ms).
    4. Parses course codes, grades, credits via Malaysian regex parser.
    5. Falls back to micro-LLM only for ambiguous/unparsed transfer lines.
    6. Updates uploaded_documents with extracted_data & fraud_flag.
    """
    doc, role = _load_authorized_document(jwt_payload, file_path=request.file_path)
    try:
        return await _extract_core(request, jwt_payload, doc, role)
    except HTTPException as he:
        _mark_document_failed(doc["id"], str(he.detail))
        raise
    except Exception as e:
        _mark_document_failed(doc["id"], str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Extraction failed unexpectedly. Please retry.",
        )


async def _extract_core(request: ExtractPDFRequest, jwt_payload: dict, doc: dict, role: str) -> ExtractPDFResponse:
    try:
        pdf_bytes = supabase_svc.download_transcript_bytes(request.file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to download PDF from '{request.file_path}': {str(e)}"
        )

    # 1. Check Metadata for Digital Forgery
    is_fraudulent = False
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            meta = doc.metadata or {}
            creator = (meta.get("creator") or "").lower()
            producer = (meta.get("producer") or "").lower()
            suspicious = ['adobe illustrator', 'photoshop', 'canva', 'ilovepdf', 'microsoft', 'word', 'google']
            if any(s in creator for s in suspicious) or any(s in producer for s in suspicious):
                is_fraudulent = True
    except Exception:
        pass

    # 2. Extract Text Lines
    try:
        raw_lines = PDFExtractor.extract_text_lines_from_bytes(pdf_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )

    if not raw_lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript PDF is empty or contains non-extractable scanned raster images."
        )

    # 2b. Load tenant grading scale & parse
    tenant_id = _extract_tenant_id(jwt_payload)
    try:
        scale = load_scale(tenant_id, client=supabase_svc.client)

        # 3. Regex Parsing
        metadata, parsed_courses, unparsed_lines = MalaysianTranscriptParser.parse_transcript_lines(raw_lines, scale=scale)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )

    # 4. Micro-LLM Fallback for ambiguous lines
    if unparsed_lines:
        ai_parsed = llm_fallback.parse_ambiguous_lines(unparsed_lines)
        if ai_parsed:
            parsed_courses.extend(ai_parsed)

    # 5. Build Structured Result
    courses_payload = [
        {
            "course_code": c.course_code,
            "course_name": c.course_name,
            "grade": c.grade,
            "credit_hour": c.credits,
            "credits": c.credits,
            "status": c.status,
            "warning": c.warning
        }
        for c in parsed_courses
    ]

    session_name = metadata.get("academic_session")
    sem_num = metadata.get("semester")
    if not session_name or not sem_num:
        if metadata.get("semesters_found"):
            first_sem = metadata["semesters_found"][0]
            parts = first_sem.split()
            if len(parts) >= 2 and parts[1].isdigit():
                sem_num = int(parts[1])
            if len(parts) >= 3:
                session_name = parts[2]

    extracted_data = {
        "academic_session": session_name,
        "semester": sem_num,
        "courses": courses_payload,
        "matric_number": metadata.get("matric_number"),
        "student_name": metadata.get("student_name"),
        "fraud_flag": is_fraudulent,
        "png": metadata.get("png"),
        "pngk": metadata.get("pngk"),
        "gpa": metadata.get("png"),
        "cgpa": metadata.get("pngk"),
        "kk_all_sem": metadata.get("kk_all_sem"),
        "kd_all_sem": metadata.get("kd_all_sem"),
        "gpa_warning": metadata.get("gpa_warning"),
        "warnings": metadata.get("warnings", [])
    }

    # 6. Persist server-side (the browser never writes extracted grades)
    extracted_data["original_courses"] = courses_payload
    update_payload = {
        "extracted_data": extracted_data,
        "fraud_flag": is_fraudulent,
        "processing_error": None,
    }
    if role == "student":
        # Student re-extraction restarts verification; advisor extraction never changes status
        update_payload["processing_status"] = "Pending_Student_Verification"
    try:
        supabase_svc.client.table("uploaded_documents").update(update_payload).eq("id", doc["id"]).execute()
    except Exception as update_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save extracted data: {update_err}",
        )

    return ExtractPDFResponse(success=True, data=extracted_data)


@router.post(
    "/finalize-approval",
    response_model=FinalizeApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Finalizes advisor approval: runs DAG audit, saves to academic_records, updates status to Approved"
)
async def finalize_approval(
    request: FinalizeApprovalRequest,
    jwt_payload: dict = Depends(verify_advisor_jwt),
):
    """
    Advisor Approval Finalization:
    1. Converts staged courses to normalized ParsedLineItem models.
    2. Fetches course catalog with prerequisite and min_grade rules.
    3. Runs PrerequisiteGraphResolver (DAG graph, min_grade verification, traffic light matrix).
    4. Persists records to 'academic_records' and full snapshot to 'degree_audits'.
    5. Updates student CGPA & academic standing in 'students'.
    6. Updates uploaded_documents row to processing_status = 'Approved'.
    """
    # Stop trusting frontend for advisor identity. Extract advisor_id and tenant_id strictly from verified JWT app_metadata or verified sub DB lookup.
    advisor_id = _extract_advisor_id(jwt_payload)
    tenant_id = _extract_tenant_id(jwt_payload)

    # Only the student's own advisor may approve, and the matric must match the document
    _load_authorized_document(
        jwt_payload,
        document_id=request.document_id,
        allow_student=False,
        expected_matric=request.matric_number,
    )

    # Validate that courses array is not empty
    if not request.courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No course records provided for approval."
        )

    matric_number = (request.matric_number or "").strip()
    if not matric_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Student matric_number is required and cannot be empty."
        )

    repeat_policy = "latest"
    if supabase_svc.client:
        try:
            t_res = supabase_svc.client.table("tenants").select("repeat_policy").eq("id", tenant_id).limit(1).execute()
            if t_res.data and t_res.data[0].get("repeat_policy"):
                repeat_policy = t_res.data[0]["repeat_policy"]
        except Exception:
            pass

    # Validate explicit semester and academic session (Requirement: missing semester/session -> 422, no fallback)
    if request.semester is None or str(request.semester).strip() == "" or not request.academic_session or str(request.academic_session).strip() == "":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing required semester or academic_session. Both must be explicitly specified."
        )

    # 1. Transform Staged Courses into ParsedLineItem objects using Tenant Grading Scale
    try:
        scale = load_scale(tenant_id, client=supabase_svc.client)

        raw_current_sem = f"Sem {request.semester} {request.academic_session}".strip()
        current_semester = normalize_semester(raw_current_sem)

        parsed_items: List[ParsedLineItem] = []
        for c in request.courses:
            code = c.course_code.replace(" ", "").upper()
            grade = c.grade.strip().upper()
            credits_val = c.credits or c.credit_hour or 3
            gp = scale.grade_points(grade, code)
            is_p = scale.is_pass(grade, code)
            in_cgpa = scale.counts_in_cgpa(grade, code)
            as_comp = scale.counts_as_completed(grade, code)

            # Status determination via grading scale rules
            if is_p and not in_cgpa and as_comp:
                item_status = "Exempted"
            elif is_p:
                item_status = "Passed"
            elif grade in {"TD", "TS"}:
                item_status = "In-Progress"
            else:
                item_status = "Failed"

            # Use c.session_semester if specified, else current_semester; normalize it
            raw_item_sem = c.session_semester.strip() if c.session_semester and c.session_semester.strip() else current_semester
            norm_item_sem = normalize_semester(raw_item_sem)

            parsed_items.append(ParsedLineItem(
                course_code=code,
                course_name=c.course_name or code,
                credits=credits_val,
                grade=grade,
                grade_point=gp,
                semester=norm_item_sem,
                status=item_status,
                warning=getattr(c, "warning", None),
                is_ai_parsed=False,
                raw_extracted_text=f"[ADVISOR APPROVED] {code} {grade} ({credits_val} cr)"
            ))

        # 2. Fetch Course Catalog & Prerequisite Graph for University
        catalog = supabase_svc.get_university_course_catalog(request.university_id)

        # 3. Fetch student's degree_template via cohort_id & extract total_credits_required
        total_required_credits = supabase_svc.get_student_required_credits(
            matric_no=matric_number,
            cohort_id=getattr(request, "cohort_id", None),
            program_code=request.program_code,
            curriculum_year=request.curriculum_year
        )

        # 3a. Fetch block_exempted_credits and graduation_credit_requirement from students table.
        block_exempted_credits, student_grad_req = supabase_svc.get_student_block_exempted_credits(
            matric_no=matric_number
        )
        if student_grad_req is not None:
            total_required_credits = student_grad_req

        # 3b. SECURE MULTI-TENANCY (Prevent IDOR):
        # Historical records scoped to verified tenant_id derived server-side
        parsed_items = fetch_and_merge_historical_records(matric_number, parsed_items, tenant_id=tenant_id)

        # 4. Run Pure Python Graph Prerequisite Audit (with min_grade & credit gates)
        display_results, summary, all_audited_records = PrerequisiteGraphResolver.audit_student_records(
            records=parsed_items,
            course_catalog=catalog,
            total_required_credits=total_required_credits,
            block_exempted_credits=block_exempted_credits,
            scale=scale,
            repeat_policy=repeat_policy,
            return_all_attempts=True
        )
        # Check cumulative CGPA against printed PNGK if provided (Never auto-correct)
        cgpa_warning: Optional[str] = None
        target_pngk = getattr(request, "pngk", None)
        if target_pngk is not None:
            try:
                target_float = float(target_pngk)
                if abs(summary.cgpa - target_float) > 0.01:
                    cgpa_warning = f"CGPA mismatch with transcript (computed {summary.cgpa:.2f} vs printed {target_float:.2f})"
            except (ValueError, TypeError):
                pass

        if cgpa_warning:
            summary.cgpa_warning = cgpa_warning
            if cgpa_warning not in summary.warnings:
                summary.warnings.append(cgpa_warning)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )

    # 4. Upsert Student Record & Persist Audits to Supabase
    student = supabase_svc.get_or_create_student(
        university_id=request.university_id,
        advisor_id=advisor_id,
        matric_number=matric_number,
        student_name=request.student_name or f"Student ({matric_number})",
        curriculum_year=request.curriculum_year,
        program_code=request.program_code
    )

    try:
        audit_id = supabase_svc.persist_audit_results(
            matric_no=matric_number,
            advisor_id=advisor_id,
            records=all_audited_records,
            summary=summary,
            storage_pdf_path=f"document:{request.document_id}",
            tenant_id=tenant_id
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )

    # 5. Update uploaded_documents status to 'Approved'
    try:
        if supabase_svc.client:
            supabase_svc.client.table("uploaded_documents").update({
                "processing_status": "Approved"
            }).eq("id", request.document_id).execute()
    except Exception as doc_update_err:
        print(f"[Document Status Update Warning] {doc_update_err}")

    # 6. Relocated Automatic Storage Purge on Advisor Approval (Zero-Waste Data Retention)
    # The file should ONLY be deleted after the advisor has visually verified it
    # and the data is successfully upserted into the database.
    purge_successful = False
    try:
        target_path = getattr(request, "storage_path", None) or getattr(request, "file_path", None)
        if not target_path and supabase_svc.client and request.document_id:
            try:
                doc_query = (
                    supabase_svc.client.table("uploaded_documents")
                    .select("file_path")
                    .eq("id", request.document_id)
                    .limit(1)
                    .execute()
                )
                if doc_query.data and doc_query.data[0].get("file_path"):
                    target_path = doc_query.data[0]["file_path"]
            except Exception as doc_fetch_err:
                print(f"[Purge Path Resolution Warning] {doc_fetch_err}")

        if target_path and target_path not in {"", "[PURGED]"}:
            _bucket = "academic-slips" if "academic-slips" in target_path else "transcripts"
            supabase_svc.delete_file_from_storage(
                bucket_name=_bucket,
                file_path=target_path
            )

        if supabase_svc.client and request.document_id:
            purge_res = supabase_svc.purge_uploaded_document_file(
                document_id=request.document_id,
                matric_no=matric_number,
                admin_staff_id=advisor_id or "ADMIN"
            )
            purge_successful = purge_res.get("success", False)
            print(f"[Automatic Purge] Document '{request.document_id}' purged successfully.")
    except Exception as purge_err:
        print(f"[Auto-Purge OUTER WARNING] Unexpected error during storage cleanup: {purge_err}")

    return FinalizeApprovalResponse(
        success=True,
        audit_id=audit_id,
        document_id=request.document_id,
        matric_number=request.matric_number,
        student_name=request.student_name or f"Student ({request.matric_number})",
        summary=summary,
        records_saved_count=len(all_audited_records),
        processing_status="Approved",
        records=display_results,
        storage_purged=purge_successful,
        warning=cgpa_warning,
        warnings=[cgpa_warning] if cgpa_warning else []
    )


@router.post(
    "/process-storage",
    response_model=DegreeAuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Process PDF transcript directly from Supabase Storage"
)
async def process_storage_transcript(
    request: StorageAuditRequest,
    jwt_payload: dict = Depends(verify_advisor_jwt),
):
    """
    Zero-Waste Direct Storage Processing
    """
    # Secure server-side identity & tenant extraction
    advisor_id = _extract_advisor_id(jwt_payload)
    tenant_id = _extract_tenant_id(jwt_payload)

    # Cross-reference: JWT identity must match claimed advisor_id if provided in request
    if request.advisor_id:
        _check_advisor_identity(jwt_payload, request.advisor_id)

    # Ownership gate: only the document's assigned advisor may trigger bulk processing.
    # Look up the uploaded_documents row by storage_path (stored as file_path).
    # A missing row means the path was never registered → 400 (not a silent 404 that
    # could be used to probe arbitrary storage paths).
    if not request.storage_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="storage_path is required to verify document ownership."
        )
    if not supabase_svc.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database client unavailable"
        )
    _ps_res = (
        supabase_svc.client.table("uploaded_documents")
        .select("id")
        .eq("file_path", request.storage_path)
        .limit(1)
        .execute()
    )
    if not _ps_res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No uploaded_documents row found for the given storage_path. "
                "Register the document via the student upload flow before processing."
            )
        )
    _ps_doc_id = _ps_res.data[0]["id"]
    _load_authorized_document(
        jwt_payload,
        document_id=_ps_doc_id,
        allow_student=False,
        expected_matric=request.matric_number or None,
    )

    # 1. Download PDF bytes
    try:
        pdf_bytes = supabase_svc.download_transcript_bytes(request.storage_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to retrieve PDF from storage path '{request.storage_path}': {str(e)}"
        )

    # 2. Extract Text Lines (PyMuPDF)
    try:
        raw_lines = PDFExtractor.extract_text_lines_from_bytes(pdf_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse PDF document structure: {str(e)}"
        )

    if not raw_lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded transcript PDF appears to be empty or an unsupported scanned image."
        )

    # 2b. Load tenant grading scale & repeat policy
    repeat_policy = "latest"
    if supabase_svc.client:
        try:
            t_res = supabase_svc.client.table("tenants").select("repeat_policy").eq("id", tenant_id).limit(1).execute()
            if t_res.data and t_res.data[0].get("repeat_policy"):
                repeat_policy = t_res.data[0]["repeat_policy"]
        except Exception:
            pass

    try:
        scale = load_scale(tenant_id, client=supabase_svc.client)

        # 3. Regex Parsing (Zero AI Cost)
        metadata, parsed_courses, unparsed_lines = MalaysianTranscriptParser.parse_transcript_lines(raw_lines, scale=scale)

        matric_no = request.matric_number or metadata.get("matric_number")
        if not matric_no or matric_no == "UNKNOWN_MATRIC":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Student matric_number could not be determined from transcript and was not provided in request."
            )
        matric_no = matric_no.strip()
        student_name = metadata.get("student_name") or f"Student ({matric_no})"

        # 4. Micro-LLM Fallback (Strictly for ambiguous/transfer lines)
        if unparsed_lines:
            ai_parsed = llm_fallback.parse_ambiguous_lines(unparsed_lines)
            if ai_parsed:
                parsed_courses.extend(ai_parsed)

        # 5. Fetch Course Catalog & Prerequisite Graph for University
        catalog = supabase_svc.get_university_course_catalog(request.university_id)

        # 6. Fetch student's degree_template via cohort_id & extract total_credits_required
        total_required_credits = supabase_svc.get_student_required_credits(
            matric_no=matric_no,
            cohort_id=getattr(request, "cohort_id", None),
            program_code=request.program_code,
            curriculum_year=request.curriculum_year
        )

        # 6a. Fetch block_exempted_credits for Diploma/Transfer students
        block_exempted_credits, student_grad_req = supabase_svc.get_student_block_exempted_credits(
            matric_no=matric_no
        )
        if student_grad_req is not None:
            total_required_credits = student_grad_req

        # 6b. SECURE MULTI-TENANCY (Prevent IDOR):
        # Historical records scoped to verified tenant_id derived server-side
        parsed_courses = fetch_and_merge_historical_records(matric_no, parsed_courses, tenant_id=tenant_id)

        # 7. Run Pure Python Graph Prerequisite Audit
        display_results, summary, all_audited_records = PrerequisiteGraphResolver.audit_student_records(
            records=parsed_courses,
            course_catalog=catalog,
            total_required_credits=total_required_credits,
            block_exempted_credits=block_exempted_credits,
            scale=scale,
            repeat_policy=repeat_policy,
            return_all_attempts=True
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )

    # 7. Upsert Student Record & Persist Audits to Supabase
    student = supabase_svc.get_or_create_student(
        university_id=request.university_id,
        advisor_id=advisor_id,
        matric_number=matric_no,
        student_name=student_name,
        curriculum_year=request.curriculum_year,
        program_code=request.program_code
    )

    try:
        audit_id = supabase_svc.persist_audit_results(
            matric_no=matric_no,
            advisor_id=advisor_id,
            records=all_audited_records,
            summary=summary,
            storage_pdf_path=request.storage_path,
            tenant_id=tenant_id
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )

    return DegreeAuditResponse(
        audit_id=audit_id,
        student_id=matric_no,
        matric_number=matric_no,
        student_name=student_name,
        university_id=request.university_id,
        advisor_id=request.advisor_id,
        summary=summary,
        records=display_results,
        unparsed_lines=unparsed_lines
    )


@router.post(
    "/purge-document",
    response_model=PurgeDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin purge of raw transcript PDF after advisor approval"
)
async def purge_document(
    request: PurgeDocumentRequest,
    jwt_payload: dict = Depends(verify_advisor_jwt),
):
    """
    Data Retention & Privacy Enforcement:
    1. Validates that the target document is marked 'Approved'.
    2. Deletes raw transcript PDF bytes from Supabase Storage.
    3. Sets file_path = '[PURGED]' in uploaded_documents.
    4. Records an immutable 'DELETE' entry in system_audit_logs.
    """
    try:
        res = supabase_svc.purge_uploaded_document_file(
            document_id=request.document_id,
            matric_no=request.matric_no,
            admin_staff_id=request.admin_staff_id or "ADMIN"
        )
        return PurgeDocumentResponse(**res)
    except PermissionError as pe:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(pe)
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Purge operation failed: {str(e)}"
        )


@router.post(
    "/reject-document",
    response_model=RejectDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject uploaded document with service-role privileges"
)
async def reject_document(
    request: RejectDocumentRequest,
    jwt_payload: dict = Depends(verify_advisor_jwt),
):
    """
    Advisor Document Rejection:
    Updates uploaded_documents table status to 'Rejected' using service-role privileges,
    bypassing client-side RLS restrictions.
    """
    advisor_id = _extract_advisor_id(jwt_payload)
    if not request.document_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="document_id is required."
        )
    # Only the student's own advisor (same tenant) may reject this document
    _load_authorized_document(jwt_payload, document_id=request.document_id, allow_student=False)

    try:
        if supabase_svc.client:
            update_payload = {
                "processing_status": "Rejected"
            }
            supabase_svc.client.table("uploaded_documents").update(update_payload).eq("id", request.document_id).execute()
            print(f"[Document Rejection] Document {request.document_id} marked as Rejected by {advisor_id}.")
        return RejectDocumentResponse(
            success=True,
            document_id=request.document_id,
            processing_status="Rejected",
            message=f"Document '{request.document_id}' successfully marked as Rejected."
        )
    except Exception as e:
        print(f"[Document Rejection Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject document: {str(e)}"
        )


@router.post(
    "/submit-verification",
    status_code=status.HTTP_200_OK,
    summary="Student confirms extracted results; server computes any changes and sends to advisor",
)
async def submit_student_verification(
    request: SubmitVerificationRequest,
    jwt_payload: dict = Depends(verify_advisor_jwt),
):
    """
    The student may correct course codes/grades the parser misread, but the
    comparison against the original extraction is done HERE, against the
    server-stored copy. Client-supplied flags (is_altered, ai_grade, fraud_flag)
    are ignored, so a student cannot hide changes from the advisor.
    """
    doc, _role = _load_authorized_document(jwt_payload, document_id=request.document_id, allow_advisor=False)

    if doc.get("processing_status") != "Pending_Student_Verification":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Document is not awaiting student verification (status: {doc.get('processing_status')})",
        )

    original = doc.get("extracted_data") or {}
    orig_courses = original.get("original_courses") or original.get("courses") or []
    if not orig_courses:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No extracted data to verify")
    if len(request.courses) != len(orig_courses):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Course list must match the extracted rows (same count and order)",
        )

    merged = []
    for orig, sub in zip(orig_courses, request.courses):
        o_code = str(orig.get("course_code") or "").replace(" ", "").upper()
        o_grade = str(orig.get("grade") or "").strip().upper()
        s_code = str(sub.get("course_code") or o_code).replace(" ", "").upper()
        s_grade = str(sub.get("grade") or o_grade).strip().upper()

        row = {k: v for k, v in orig.items() if k not in ("is_altered", "ai_grade", "ai_course_code")}
        altered = False
        if s_code != o_code:
            row["ai_course_code"] = orig.get("course_code")
            row["course_code"] = s_code
            altered = True
        if s_grade != o_grade:
            row["ai_grade"] = orig.get("grade")
            row["grade"] = s_grade
            altered = True
        row["is_altered"] = altered
        merged.append(row)

    altered_count = sum(1 for r in merged if r["is_altered"])
    new_data = dict(original)
    new_data["original_courses"] = orig_courses
    new_data["courses"] = merged
    new_data["student_altered_count"] = altered_count

    try:
        supabase_svc.client.table("uploaded_documents").update({
            "extracted_data": new_data,
            "processing_status": "Pending_Advisor_Approval",
        }).eq("id", doc["id"]).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit verification: {e}",
        )

    return {"success": True, "document_id": doc["id"], "altered_count": altered_count}
