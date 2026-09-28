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
        ParsedLineItem
    )
    from app.engine.extractor import PDFExtractor
    from app.engine.parsers.malaysian_regex import (
        MalaysianTranscriptParser,
        GRADE_POINTS,
        PASSING_GRADES,
        NEUTRAL_PASSING_GRADES
    )
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
        ParsedLineItem
    )
    from backend.app.engine.extractor import PDFExtractor
    from backend.app.engine.parsers.malaysian_regex import (
        MalaysianTranscriptParser,
        GRADE_POINTS,
        PASSING_GRADES,
        NEUTRAL_PASSING_GRADES
    )
    from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
    from backend.app.engine.llm_fallback import MicroLLMFallback
    from backend.app.core.supabase_client import SupabaseService
    from backend.app.core.auth import verify_advisor_jwt

router = APIRouter(prefix="/audit", tags=["Degree Audit"])
supabase_svc = SupabaseService()
llm_fallback = MicroLLMFallback()

def fetch_and_merge_historical_records(matric_no: str, new_records: List[ParsedLineItem], tenant_id: str = "UTM") -> List[ParsedLineItem]:
    if not supabase_svc.client or not matric_no:
        return new_records
    try:
        new_semesters = {r.semester for r in new_records if r.semester}
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
        
        merged = []
        for r in existing:
            if r.get("semester") not in new_semesters:
                merged.append(ParsedLineItem(
                    course_code=r.get("course_code"),
                    course_name=r.get("course_name") or r.get("course_code"),
                    credits=r.get("credits") or 3,
                    grade=r.get("grade"),
                    grade_point=float(r.get("grade_point") or 0.0),
                    semester=r.get("semester"),
                    status=r.get("status"),
                    is_ai_parsed=r.get("is_ai_parsed", False),
                    raw_extracted_text=r.get("raw_extracted_text", "")
                ))
        return merged + new_records
    except Exception as e:
        print(f"[Merge Historical] Error fetching historical records: {e}")
        return new_records


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

    return "UTM"


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
                return resolved or raw_tenant or "UTM"
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

    # 3. Regex Parsing
    metadata, parsed_courses, unparsed_lines = MalaysianTranscriptParser.parse_transcript_lines(raw_lines)

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
            "status": c.status
        }
        for c in parsed_courses
    ]

    session_name = "2024/2025"
    sem_num = 1
    if metadata.get("semesters_found"):
        first_sem = metadata["semesters_found"][0]
        # parse e.g. "Sem 1 2024/2025"
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
        "fraud_flag": is_fraudulent
    }

    # 6. Update uploaded_documents if matching file_path exists
    try:
        if supabase_svc.client:
            supabase_svc.client.table("uploaded_documents").update({
                "extracted_data": extracted_data,
                "fraud_flag": is_fraudulent
            }).eq("file_path", request.file_path).execute()
    except Exception as update_err:
        print(f"[Supabase Extract Update Warning] {update_err}")

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

    # Validate that courses array is not empty
    if not request.courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No course records provided for approval."
        )

    # 1. Transform Staged Courses into ParsedLineItem objects
    parsed_items: List[ParsedLineItem] = []
    current_semester = f"Sem {request.semester} {request.academic_session}"

    for c in request.courses:
        code = c.course_code.replace(" ", "").upper()
        grade = c.grade.strip().upper()
        credits_val = c.credits or c.credit_hour or 3
        gp = GRADE_POINTS.get(grade, 0.00)

        # Status determination
        if grade in PASSING_GRADES:
            item_status = "Exempted" if grade in NEUTRAL_PASSING_GRADES else "Passed"
        elif grade in {"TD", "TS"}:
            item_status = "In-Progress"
        else:
            item_status = "Failed"

        parsed_items.append(ParsedLineItem(
            course_code=code,
            course_name=c.course_name or code,
            credits=credits_val,
            grade=grade,
            grade_point=gp,
            semester=c.session_semester or current_semester,
            status=item_status,
            is_ai_parsed=False,
            raw_extracted_text=f"[ADVISOR APPROVED] {code} {grade} ({credits_val} cr)"
        ))

    matric_number = (request.matric_number or "").strip()
    if not matric_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Student matric_number is required and cannot be empty."
        )

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
    #     Diploma/Transfer students enter with pre-approved credits that must be added to
    #     their earned total. graduation_credit_requirement, if set, overrides the template
    #     default so the progress bar reflects the student's actual adjusted target.
    block_exempted_credits, student_grad_req = supabase_svc.get_student_block_exempted_credits(
        matric_no=matric_number
    )
    if student_grad_req is not None:
        total_required_credits = student_grad_req

    # 3b. SECURE MULTI-TENANCY (Prevent IDOR):
    # Historical records scoped to verified tenant_id derived server-side
    parsed_items = fetch_and_merge_historical_records(matric_number, parsed_items, tenant_id=tenant_id)

    # 4. Run Pure Python Graph Prerequisite Audit (with min_grade & credit gates)
    audited_records, summary = PrerequisiteGraphResolver.audit_student_records(
        records=parsed_items,
        course_catalog=catalog,
        total_required_credits=total_required_credits,
        block_exempted_credits=block_exempted_credits
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

    audit_id = supabase_svc.persist_audit_results(
        matric_no=matric_number,
        advisor_id=advisor_id,
        records=audited_records,
        summary=summary,
        storage_pdf_path=f"document:{request.document_id}",
        tenant_id=tenant_id
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
        records_saved_count=len(audited_records),
        processing_status="Approved",
        records=audited_records,
        storage_purged=purge_successful
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

    # 3. Regex Parsing (Zero AI Cost)
    metadata, parsed_courses, unparsed_lines = MalaysianTranscriptParser.parse_transcript_lines(raw_lines)

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
    audited_records, summary = PrerequisiteGraphResolver.audit_student_records(
        records=parsed_courses,
        course_catalog=catalog,
        total_required_credits=total_required_credits,
        block_exempted_credits=block_exempted_credits
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

    audit_id = supabase_svc.persist_audit_results(
        matric_no=matric_no,
        advisor_id=advisor_id,
        records=audited_records,
        summary=summary,
        storage_pdf_path=request.storage_path,
        tenant_id=tenant_id
    )

    return DegreeAuditResponse(
        audit_id=audit_id,
        student_id=matric_no,
        matric_number=matric_no,
        student_name=student_name,
        university_id=request.university_id,
        advisor_id=request.advisor_id,
        summary=summary,
        records=audited_records,
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
