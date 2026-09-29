import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.app.main import app

client = TestClient(app)

from backend.app.core.auth import verify_advisor_jwt

def override_verify_jwt():
    return {"sub": "mock-sub", "email": "student@graduate.utm.my"}

def override_verify_jwt_staff():
    return {"sub": "mock-sub", "email": "staff@utm.my"}

@pytest.fixture(autouse=True)
def setup_overrides():
    app.dependency_overrides[verify_advisor_jwt] = override_verify_jwt
    yield

def test_student_register_no_token():
    # When overriding, FastAPI doesn't check the token, so we'll bypass this test or remove override for it
    app.dependency_overrides.pop(verify_advisor_jwt, None)
    response = client.post("/api/v1/register/student", json={
        "cohort_code": "SECJ24",
        "matric_no": "A24CS0001",
        "full_name": "Test Student"
    })
    assert response.status_code in [401, 403, 422]
    app.dependency_overrides[verify_advisor_jwt] = override_verify_jwt

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_student_register_locked_cohort(mock_supa):
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    # Locked cohort
    mock_svc.client.table().select().eq().limit().execute.return_value = MagicMock(data=[
        {"id": "c1", "is_locked": True, "tenant_id": "UTM", "advisor_staff_id": "ADV1", "template_id": "t1"}
    ])
    
    response = client.post("/api/v1/register/student", json={
        "cohort_code": "SECJ24",
        "matric_no": "A24CS0001",
        "full_name": "Test Student"
    }, headers={"Authorization": "Bearer token"})
    
    assert response.status_code == 400
    assert "locked" in response.json()["detail"].lower()

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_student_register_null_tenant(mock_supa):
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    # Cohort with null tenant
    mock_svc.client.table().select().eq().limit().execute.return_value = MagicMock(data=[
        {"id": "c1", "is_locked": False, "tenant_id": None, "advisor_staff_id": "ADV1", "template_id": "t1"}
    ])
    
    response = client.post("/api/v1/register/student", json={
        "cohort_code": "SECJ24",
        "matric_no": "A24CS0001",
        "full_name": "Test Student"
    }, headers={"Authorization": "Bearer token"})
    
    assert response.status_code == 500
    assert "no tenant" in response.json()["detail"].lower()

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_student_register_duplicate_user(mock_supa):
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    mock_svc.client.table().select().eq().limit().execute.side_effect = [
        MagicMock(data=[{"id": "c1", "is_locked": False, "tenant_id": "UTM", "advisor_staff_id": "ADV1", "template_id": "t1"}]), # Cohort
        MagicMock(data=[{"program_code": "SECJ", "syllabus_year": "2024"}]), # Template
        MagicMock(data=[{"matric_regex": ".*", "student_email_domains": ["graduate.utm.my"]}]), # Tenant Config
        MagicMock(data=[{"user_id": "mock-sub"}]) # Duplicate user check
    ]
    mock_svc.client.table().select().eq().eq().execute.return_value = MagicMock(data=[])
    
    response = client.post("/api/v1/register/student", json={
        "cohort_code": "SECJ24",
        "matric_no": "A24CS0001",
        "full_name": "Test Student"
    }, headers={"Authorization": "Bearer token"})
    
    assert response.status_code == 409
    assert "already registered as student" in response.json()["detail"].lower()

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_student_register_lowercase_matric(mock_supa):
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    mock_svc.client.table().select().eq().limit().execute.side_effect = [
        MagicMock(data=[{"id": "c1", "is_locked": False, "tenant_id": "UTM", "advisor_staff_id": "ADV1", "template_id": "t1"}]), # Cohort
        MagicMock(data=[{"program_code": "SECJ", "syllabus_year": "2024"}]), # Template
        MagicMock(data=[{"matric_regex": "^[A-Z][0-9]{2}[A-Z]{2}[0-9]{4}$", "student_email_domains": ["graduate.utm.my"]}]), # Tenant Config
        MagicMock(data=[]) # Duplicate user check
    ]
    mock_svc.client.table().select().eq().eq().execute.return_value = MagicMock(data=[])
    
    response = client.post("/api/v1/register/student", json={
        "cohort_code": "SECJ24",
        "matric_no": "a24cs0001", # lowercase
        "full_name": "Test Student"
    }, headers={"Authorization": "Bearer token"})
    
    # Validates because a24cs0001 becomes A24CS0001 and passes regex
    # Then attempts insert, which we'll mock to succeed
    assert response.status_code == 200

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_advisor_register_expired_or_used_invite(mock_supa):
    app.dependency_overrides[verify_advisor_jwt] = override_verify_jwt_staff
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    # Duplicate check for staff_id
    mock_svc.client.table().select().eq().limit().execute.return_value = MagicMock(data=[])
    
    # Invite claim returns empty
    mock_svc.client.table().update().eq().is_().gt().execute.return_value = MagicMock(data=[])
    
    response = client.post("/api/v1/register/advisor", json={
        "invite_code": "EXPIRED123",
        "full_name": "Test Staff",
        "staff_id": "ADV-002",
        "department": "CS"
    }, headers={"Authorization": "Bearer token"})
    
    assert response.status_code == 400
    assert "invite code" in response.json()["detail"].lower()

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_student_register_app_metadata_failure(mock_supa):
    app.dependency_overrides[verify_advisor_jwt] = override_verify_jwt
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    mock_svc.client.table().select().eq().limit().execute.side_effect = [
        MagicMock(data=[{"id": "c1", "is_locked": False, "tenant_id": "UTM", "advisor_staff_id": "ADV1", "template_id": "t1"}]), # Cohort
        MagicMock(data=[{"program_code": "SECJ", "syllabus_year": "2024"}]), # Template
        MagicMock(data=[{"matric_regex": ".*", "student_email_domains": ["graduate.utm.my"]}]), # Tenant Config
        MagicMock(data=[])  # Duplicate user check
    ]
    mock_svc.client.table().select().eq().eq().execute.return_value = MagicMock(data=[])
    
    mock_svc.client.auth.admin.update_user_by_id.side_effect = Exception("Auth API Down")
    
    response = client.post("/api/v1/register/student", json={
        "cohort_code": "SECJ24",
        "matric_no": "A24CS0001",
        "full_name": "Test Student"
    }, headers={"Authorization": "Bearer token"})
    
    assert response.status_code == 500
    assert "role assignment failed" in response.json()["detail"].lower()
    
    # Assert row gets deleted
    mock_svc.client.table().delete().eq().eq().eq.assert_called_with("matric_no", "A24CS0001")

@patch("backend.app.v1.endpoints.register.SupabaseService")
def test_advisor_register_insert_failure(mock_supa):
    app.dependency_overrides[verify_advisor_jwt] = override_verify_jwt_staff
    mock_svc = MagicMock()
    mock_supa.return_value = mock_svc
    
    # Duplicate staff_id
    mock_svc.client.table().select().eq().limit().execute.return_value = MagicMock(data=[])
    
    # Invite claim success
    mock_svc.client.table().update().eq().is_().gt().execute.return_value = MagicMock(data=[{"tenant_id": "UTM"}])
    
    # Insert fails with unique constraint
    mock_svc.client.table().insert().execute.side_effect = Exception("duplicate key value violates unique constraint")
    
    response = client.post("/api/v1/register/advisor", json={
        "invite_code": "INVITE123",
        "full_name": "Test Staff",
        "staff_id": "ADV-003",
        "department": "CS"
    }, headers={"Authorization": "Bearer token"})
    
    assert response.status_code == 409
    
    # Assert invite is released
    mock_svc.client.table().update().eq().eq.assert_called_with("used_by", "mock-sub")
