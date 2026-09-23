"""
Integration and End-to-End Tests for Finalize Approval Endpoint
Validates that approving staged transcript data:
1. Passes through DAG graph resolver with prerequisite min-grade checks
2. Persists validated results into 'academic_records' and 'degree_audits'
3. Updates 'uploaded_documents.processing_status' to 'Approved'
4. Enforces strict advisor_id requirement (throws 400 if missing)
"""

import sys
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

try:
    from app.main import app
    from app.schemas.audit import FinalizeApprovalRequest, ExtractedCourseItem
    from app.core.auth import verify_advisor_jwt
except ImportError:
    from backend.app.main import app
    from backend.app.schemas.audit import FinalizeApprovalRequest, ExtractedCourseItem
    from backend.app.core.auth import verify_advisor_jwt

client = TestClient(app)

# Override JWT verification for test client
app.dependency_overrides[verify_advisor_jwt] = lambda: {
    "email": "advisor@university.edu.my",
    "sub": "mock-advisor-uid"
}

AUTH_HEADERS = {"Authorization": "Bearer mock-test-token"}


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
        "advisor_id": "STAFF-001",
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
    patch_id_target = "app.v1.endpoints.audit._check_advisor_identity" if "app.v1.endpoints.audit" in sys.modules else "backend.app.v1.endpoints.audit._check_advisor_identity"
    
    with patch(patch_target) as mock_svc, patch(patch_id_target) as mock_check_id:
        mock_svc.get_university_course_catalog.return_value = mock_catalog
        mock_svc.get_or_create_student.return_value = mock_student
        mock_svc.persist_audit_results.return_value = "audit-uuid-12345"
        mock_svc.client = mock_supabase

        response = client.post("/api/v1/audit/finalize-approval", json=payload, headers=AUTH_HEADERS)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["audit_id"] == "audit-uuid-12345"
        assert data["processing_status"] == "Approved"
        assert data["records_saved_count"] == 2
        assert data["summary"]["overall_traffic_light"] == "GREEN"
        assert data["records"][0]["traffic_light"] == "GREEN"
        assert data["records"][1]["traffic_light"] == "GREEN"

        # Verify persist_audit_results was called directly with matric_no string
        mock_svc.persist_audit_results.assert_called_once()
        call_args = mock_svc.persist_audit_results.call_args[1]
        assert (call_args.get("matric_no") or call_args.get("student_id")) == "TEST-SE24-FINAL"
        records = call_args["records"]
        assert len(records) == 2
        assert records[0].course_code == "SECJ1013"
        assert records[0].prerequisite_met is True
        assert records[1].course_code == "SECJ1023"
        assert records[1].prerequisite_met is True

        # Verify uploaded_documents was updated to 'Approved'
        mock_supabase.table.assert_called_with("uploaded_documents")
        mock_supabase.table().update.assert_called_with({"processing_status": "Approved"})


def test_finalize_approval_missing_jwt_advisor_id_401():
    """Test that a JWT lacking advisor identity returns 401 Unauthorized."""
    # Temporarily override JWT dependency to return an empty dict (no advisor identity)
    app.dependency_overrides[verify_advisor_jwt] = lambda: {}
    payload = {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "TEST-SE24-FINAL",
        "courses": [
            {
                "course_code": "SECJ1013",
                "grade": "A"
            }
        ]
    }
    try:
        response = client.post("/api/v1/audit/finalize-approval", json=payload, headers=AUTH_HEADERS)
        assert response.status_code == 401
        assert "Valid advisor identity" in response.json()["detail"]
    finally:
        # Restore mock advisor JWT
        app.dependency_overrides[verify_advisor_jwt] = lambda: {
            "email": "advisor@university.edu.my",
            "sub": "mock-advisor-uid"
        }


def test_finalize_approval_empty_courses_error():
    """Test validation error when no courses are submitted."""
    payload = {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "TEST-SE24-EMPTY",
        "advisor_id": "STAFF-001",
        "courses": []
    }
    patch_id_target = "app.v1.endpoints.audit._check_advisor_identity" if "app.v1.endpoints.audit" in sys.modules else "backend.app.v1.endpoints.audit._check_advisor_identity"
    with patch(patch_id_target):
        response = client.post("/api/v1/audit/finalize-approval", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 400
    assert "No course records provided" in response.json()["detail"]


def test_finalize_approval_missing_matric_422():
    """Test validation error (422) when matric_number is missing or empty."""
    payload = {
        "document_id": "99999999-9999-9999-9999-999999999999",
        "matric_number": "   ",
        "advisor_id": "STAFF-001",
        "courses": [
            {
                "course_code": "SECJ1013",
                "grade": "A"
            }
        ]
    }
    patch_id_target = "app.v1.endpoints.audit._check_advisor_identity" if "app.v1.endpoints.audit" in sys.modules else "backend.app.v1.endpoints.audit._check_advisor_identity"
    with patch(patch_id_target):
        response = client.post("/api/v1/audit/finalize-approval", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422
    assert "matric_number is required" in response.json()["detail"]
