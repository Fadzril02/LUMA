"""
Smart Academic Assessment System - Degree Audit Processing Endpoints
"""

import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any, List

try:
    from app.schemas.audit import (
        StorageAuditRequest,
        DegreeAuditResponse,
        AuditSummary,
        CourseAuditResult,
        PurgeDocumentRequest,
        PurgeDocumentResponse,
        FinalizeApprovalRequest,
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
except ImportError:
    from backend.app.schemas.audit import (
        StorageAuditRequest,
        DegreeAuditResponse,
        AuditSummary,
        CourseAuditResult,
        PurgeDocumentRequest,
        PurgeDocumentResponse,
        FinalizeApprovalRequest,
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

router = APIRouter(prefix="/audit", tags=["Degree Audit"])
supabase_svc = SupabaseService()
llm_fallback = MicroLLMFallback()


@router.post(
    "/extract",
    response_model=ExtractPDFResponse,
    status_code=status.HTTP_200_OK,
    summary="Extracts course grades and metadata from a transcript PDF in storage"
)
async def extract_transcript_from_storage(request: ExtractPDFRequest):
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
async def finalize_approval(request: FinalizeApprovalRequest):
    """
    Advisor Approval Finalization:
    1. Converts staged courses to normalized ParsedLineItem models.
    2. Fetches course catalog with prerequisite and min_grade rules.
    3. Runs PrerequisiteGraphResolver (DAG graph, min_grade verification, traffic light matrix).
    4. Persists records to 'academic_records' and full snapshot to 'degree_audits'.
    5. Updates student CGPA & academic standing in 'students'.
    6. Updates uploaded_documents row to processing_status = 'Approved'.
    """
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

    # 2. Fetch Course Catalog & Prerequisite Graph for University
    catalog = supabase_svc.get_university_course_catalog(request.university_id)

    # 3. Run Pure Python Graph Prerequisite Audit (with min_grade & credit gates)
    audited_records, summary = PrerequisiteGraphResolver.audit_student_records(
        records=parsed_items,
        course_catalog=catalog
    )

    # 4. Upsert Student Record & Persist Audits to Supabase
    student = supabase_svc.get_or_create_student(
        university_id=request.university_id,
        advisor_id=request.advisor_id or "STAFF-LIYANA",
        matric_number=request.matric_number,
        student_name=request.student_name or f"Student ({request.matric_number})",
        curriculum_year=request.curriculum_year or "2023/2024",
        program_code=request.program_code or "SECJ"
    )

    student_id = student.get("id") or "00000000-0000-0000-0000-000000000000"

    audit_id = supabase_svc.persist_audit_results(
        student_id=student_id,
        advisor_id=request.advisor_id or "STAFF-LIYANA",
        records=audited_records,
        summary=summary,
        storage_pdf_path=f"document:{request.document_id}"
    )

    # 5. Update uploaded_documents status to 'Approved'
    try:
        if supabase_svc.client:
            supabase_svc.client.table("uploaded_documents").update({
                "processing_status": "Approved"
            }).eq("id", request.document_id).execute()
    except Exception as doc_update_err:
        print(f"[Document Status Update Warning] {doc_update_err}")

    return FinalizeApprovalResponse(
        success=True,
        audit_id=audit_id,
        document_id=request.document_id,
        matric_number=request.matric_number,
        student_name=request.student_name or f"Student ({request.matric_number})",
        summary=summary,
        records_saved_count=len(audited_records),
        processing_status="Approved",
        records=audited_records
    )


@router.post(
    "/process-storage",
    response_model=DegreeAuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Process PDF transcript directly from Supabase Storage"
)
async def process_storage_transcript(request: StorageAuditRequest):
    """
    Zero-Waste Direct Storage Processing
    """
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

    matric_no = request.matric_number or metadata.get("matric_number") or "UNKNOWN_MATRIC"
    student_name = metadata.get("student_name") or f"Student ({matric_no})"

    # 4. Micro-LLM Fallback (Strictly for ambiguous/transfer lines)
    if unparsed_lines:
        ai_parsed = llm_fallback.parse_ambiguous_lines(unparsed_lines)
        if ai_parsed:
            parsed_courses.extend(ai_parsed)

    # 5. Fetch Course Catalog & Prerequisite Graph for University
    catalog = supabase_svc.get_university_course_catalog(request.university_id)

    # 6. Run Pure Python Graph Prerequisite Audit
    audited_records, summary = PrerequisiteGraphResolver.audit_student_records(
        records=parsed_courses,
        course_catalog=catalog
    )

    # 7. Upsert Student Record & Persist Audits to Supabase
    student = supabase_svc.get_or_create_student(
        university_id=request.university_id,
        advisor_id=request.advisor_id,
        matric_number=matric_no,
        student_name=student_name,
        curriculum_year=request.curriculum_year or "2023/2024",
        program_code=request.program_code or "SECJ"
    )

    student_id = student.get("id") or "00000000-0000-0000-0000-000000000000"

    audit_id = supabase_svc.persist_audit_results(
        student_id=student_id,
        advisor_id=request.advisor_id,
        records=audited_records,
        summary=summary,
        storage_pdf_path=request.storage_path
    )

    return DegreeAuditResponse(
        audit_id=audit_id,
        student_id=student_id,
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
async def purge_document(request: PurgeDocumentRequest):
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
