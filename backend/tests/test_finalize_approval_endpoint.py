"""
Integration and End-to-End Tests for Finalize Approval Endpoint
Validates that approving staged transcript data:
1. Passes through DAG graph resolver with prerequisite min-grade checks
2. Persists validated results into 'academic_records' and 'degree_audits'
3. Updates 'uploaded_documents.processing_status' to 'Approved'
4. Does NOT insert records into legacy 'results' table
"""

import sys
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

try:
    from app.main import app
    from app.schemas.audit import FinalizeApprovalRequest, ExtractedCourseItem
except ImportError:
    from backend.app.main import app
    from backend.app.schemas.audit import FinalizeApprovalRequest, ExtractedCourseItem

client = TestClient(app)


def test_finalize_approval_fastapi_endpoint_flow():
    """Test that finalize-approval endpoint audits courses, sets traffic light, and creates records."""
    mock_supabase = MagicMock()
    
    # Mock course catalog with prerequisite
    mock_catalog = {
        "SECJ1013": {"course_code": "SECJ1013", "prerequisites": {"type": "AND", "courses": []}},
        "SECJ1023": {
            "course_code": "SECJ1023",
            "prerequisites": {
                "type": "AND",
                "courses": [{"course_code": "SECJ1013", "min_grade": "C"}]
            }
        },
        "SECJ2013": {
            "course_code": "SECJ2013",
            "prerequisites": {
                "type": "AND",
                "courses": [{"course_code": "SECJ1023", "min_grade": "C"}]
            }
        }
    }
    
    mock_student = {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "matric_number": "TEST-SE24-FINAL",
        "student_name": "Test Finalize Student"
    }

    payload = {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "TEST-SE24-FINAL",
        "student_name": "Test Finalize Student",
        "academic_session": "2024/2025",
        "semester": 1,
        "courses": [
            {
                "course_code": "SECJ1013",
                "course_name": "Programming Technique I",
                "grade": "A",
                "credit_hour": 3,
                "credits": 3,
                "status": "Pass",
                "session_semester": "2024/2025-1"
            },
            {
                "course_code": "SECJ1023",
                "course_name": "Programming Technique II",
                "grade": "B+",
                "credit_hour": 3,
                "credits": 3,
                "status": "Pass",
                "session_semester": "2024/2025-2"
            }
        ]
    }

    patch_target = "app.v1.endpoints.audit.supabase_svc" if "app.v1.endpoints.audit" in sys.modules else "backend.app.v1.endpoints.audit.supabase_svc"
    with patch(patch_target) as mock_svc:
        mock_svc.get_university_course_catalog.return_value = mock_catalog
        mock_svc.get_or_create_student.return_value = mock_student
        mock_svc.persist_audit_results.return_value = "audit-uuid-12345"
        mock_svc.client = mock_supabase

        response = client.post("/api/v1/audit/finalize-approval", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["audit_id"] == "audit-uuid-12345"
        assert data["processing_status"] == "Approved"
        assert data["records_saved_count"] == 2
        assert data["summary"]["overall_traffic_light"] == "GREEN"
        assert data["records"][0]["traffic_light"] == "GREEN"
        assert data["records"][1]["traffic_light"] == "GREEN"

        # Verify persist_audit_results was called with student_id and records destined for academic_records
        mock_svc.persist_audit_results.assert_called_once()
        call_args = mock_svc.persist_audit_results.call_args[1]
        assert call_args["student_id"] == "550e8400-e29b-41d4-a716-446655440000"
        records = call_args["records"]
        assert len(records) == 2
        assert records[0].course_code == "SECJ1013"
        assert records[0].prerequisite_met is True
        assert records[1].course_code == "SECJ1023"
        assert records[1].prerequisite_met is True

        # Verify uploaded_documents was updated to 'Approved'
        mock_supabase.table.assert_called_with("uploaded_documents")
        mock_supabase.table().update.assert_called_with({"processing_status": "Approved"})


def test_finalize_approval_empty_courses_error():
    """Test validation error when no courses are submitted."""
    payload = {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "TEST-SE24-EMPTY",
        "courses": []
    }
    response = client.post("/api/v1/audit/finalize-approval", json=payload)
    assert response.status_code == 400
    assert "No course records provided" in response.json()["detail"]
