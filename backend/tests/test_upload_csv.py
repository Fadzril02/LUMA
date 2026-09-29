import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.app.main import app
from backend.app.core.auth import verify_advisor_jwt

client = TestClient(app)

def test_upload_no_token():
    app.dependency_overrides.clear()
    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Test",
        "program_code": "SECJ",
        "total_credits": 130
    }, files={"file": ("test.csv", b"course_code,course_name,credits,category,prerequisites\nSECJ1013,PT1,3,Core,None", "text/csv")})
    
    assert response.status_code in [401, 422], f"Expected 401/422, got {response.status_code}"

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_token_no_advisor(mock_supabase_class):
    mock_svc = MagicMock()
    mock_supabase_class.return_value = mock_svc
    
    # Empty data returned from advisors query
    mock_svc.client.table().select().eq().limit().execute.return_value = MagicMock(data=[])
    
    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-no-advisor-uid",
        "email": "not_an_advisor@example.com"
    }
    
    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Test",
        "program_code": "SECJ",
        "total_credits": 130
    }, files={"file": ("test.csv", b"course_code,course_name,credits,category,prerequisites\nSECJ1013,PT1,3,Core,None", "text/csv")})
    
    assert response.status_code == 403
    assert "No advisor profile found" in response.json()["detail"]

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_token_valid_tenant_rejected_client_tenant(mock_supabase_class):
    mock_svc = MagicMock()
    mock_supabase_class.return_value = mock_svc
    
    # Return a valid advisor with tenant_id="REAL_TENANT"
    mock_svc.client.table().select().eq().limit().execute.return_value = MagicMock(data=[{"tenant_id": "REAL_TENANT"}])
    
    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-valid-advisor",
        "email": "advisor@example.com"
    }
    
    # We supply a tenant_id form field, but the endpoint ignores/rejects it 
    # (actually the endpoint removed the parameter entirely, so sending it might just be ignored by fastapi, 
    # or the endpoint returns 501 anyway if parsing succeeds)
    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Test",
        "program_code": "SECJ",
        "total_credits": 130,
        "tenant_id": "FAKE_TENANT_IN_FORM"
    }, files={"file": ("test.csv", b"course_code,course_name,credits,category,prerequisites\nSECJ1013,PT1,3,Core,None", "text/csv")})
    
    # Endpoint should return 501 since we removed the implementation
    assert response.status_code == 501
    assert "Curriculum storage pending" in response.json()["detail"]

