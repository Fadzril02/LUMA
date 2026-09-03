"""
[PROJECT_NAME] Audit Processing Endpoints
Company: [COMPANY_NAME]
"""

from fastapi import APIRouter, HTTPException, Depends, status
from backend.app.schemas.audit import (
    StorageAuditRequest,
    DegreeAuditResponse,
    AuditSummary,
    CourseAuditResult
)
from backend.app.engine.extractor import PDFExtractor
from backend.app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
from backend.app.engine.llm_fallback import MicroLLMFallback
from backend.app.services.supabase_service import SupabaseService

router = APIRouter(prefix="/audit", tags=["Degree Audit"])
supabase_svc = SupabaseService()
llm_fallback = MicroLLMFallback()


@router.post(
    "/process-storage",
    response_model=DegreeAuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Process PDF transcript directly from Supabase Storage"
)
async def process_storage_transcript(request: StorageAuditRequest):
    """
    Zero-Waste Direct Storage Processing:
    1. Downloads PDF bytes securely from Supabase Storage bucket ('transcripts') using Service Role Key.
    2. Runs PyMuPDF in-memory text extraction (<50ms).
    3. Executes Malaysian university regex parser (extracts course codes & grades).
    4. Triggers micro-LLM fallback strictly for unmatched/ambiguous lines if needed.
    5. Evaluates prerequisite DAG & assigns Traffic Light status.
    6. Persists records to Supabase PostgreSQL with RLS compliance.
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
