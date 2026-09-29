import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.app.main import app
from backend.app.core.auth import verify_advisor_jwt

client = TestClient(app)

def create_mock_supabase():
    mock_svc = MagicMock()
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.insert.return_value = mock_query
    mock_query.delete.return_value = mock_query
    mock_svc.client.table.return_value = mock_query
    return mock_svc, mock_query

@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()

def test_upload_no_token():
    app.dependency_overrides.clear()
    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Test",
        "program_code": "SECJ",
        "syllabus_year": "2024/2025",
        "total_credits": 130
    }, files={"file": ("test.csv", b"course_code,course_name,credits,category,prerequisites\nSECJ1013,PT1,3,Core,None", "text/csv")})
    
    assert response.status_code in [401, 422]

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_csv_success(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # 1. advisors table lookup
        MagicMock(data=[{"tenant_id": "UTM"}]),
        # 2. tenants table lookup
        MagicMock(data=[{"name": "Universiti Teknologi Malaysia", "default_prereq_min_grade": "C"}]),
        # 3. existing degree_templates check
        MagicMock(data=[]),
        # 4. degree_templates insert
        MagicMock(data=[{"id": "tmpl-uuid-123"}]),
        # 5. template_courses insert
        MagicMock(data=[{"id": "tc-1"}, {"id": "tc-2"}])
    ]

    csv_data = (
        b"course_code,course_name,credits,category,prerequisites\n"
        b"SECJ1013,Programming Technique I,3,Core,None\n"
        b"SECJ1023,Programming Technique II,3,Core,SECJ1013 min_grade: B\n"
    )

    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Software Engineering 2024/2025",
        "program_code": "SECJ",
        "syllabus_year": "2024/2025",
        "total_credits": 130
    }, files={"file": ("curriculum.csv", csv_data, "text/csv")})

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    res_json = response.json()
    assert res_json["template_id"] == "tmpl-uuid-123"
    assert res_json["total_parsed"] == 2
    assert res_json["total_inserted"] == 2

    # Verify template insert args
    insert_calls = mock_query.insert.call_args_list
    assert len(insert_calls) == 2

    tmpl_payload = insert_calls[0][0][0]
    assert tmpl_payload["tenant_id"] == "UTM"
    assert tmpl_payload["university_name"] == "Universiti Teknologi Malaysia"
    assert tmpl_payload["program_code"] == "SECJ"
    assert tmpl_payload["syllabus_year"] == "2024/2025"
    assert tmpl_payload["total_credits_required"] == 130

    courses_payload = insert_calls[1][0][0]
    assert len(courses_payload) == 2
    assert courses_payload[0]["course_code"] == "SECJ1013"
    assert courses_payload[0]["is_core_requirement"] is True
    assert courses_payload[0]["prerequisites"]["min_grade"] == "C" # tenant default

    assert courses_payload[1]["course_code"] == "SECJ1023"
    assert courses_payload[1]["is_core_requirement"] is True
    assert courses_payload[1]["prerequisites"]["min_grade"] == "B" # custom from CSV

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_csv_duplicate_409(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # 1. advisors table lookup
        MagicMock(data=[{"tenant_id": "UTM"}]),
        # 2. tenants table lookup
        MagicMock(data=[{"name": "Universiti Teknologi Malaysia", "default_prereq_min_grade": "C"}]),
        # 3. existing degree_templates check returns an existing template
        MagicMock(data=[{"id": "already-exists-tmpl"}])
    ]

    csv_data = b"course_code,course_name,credits,category,prerequisites\nSECJ1013,PT1,3,Core,None\n"

    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Software Engineering 2024/2025",
        "program_code": "SECJ",
        "syllabus_year": "2024/2025",
        "total_credits": 130
    }, files={"file": ("curriculum.csv", csv_data, "text/csv")})

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_csv_bad_row_400(mock_supabase_class):
    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    # CSV with bad row (Row 3 has empty course code)
    csv_data = (
        b"course_code,course_name,credits,category,prerequisites\n"
        b"SECJ1013,Programming Technique I,3,Core,None\n"
        b",Missing Code Course,3,Core,None\n"
    )

    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Software Engineering 2024/2025",
        "program_code": "SECJ",
        "syllabus_year": "2024/2025",
        "total_credits": 130
    }, files={"file": ("curriculum.csv", csv_data, "text/csv")})

    assert response.status_code == 400
    assert "row 3" in response.json()["detail"].lower()

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_csv_courses_insert_failure_rollback(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # 1. advisors table lookup
        MagicMock(data=[{"tenant_id": "UTM"}]),
        # 2. tenants table lookup
        MagicMock(data=[{"name": "Universiti Teknologi Malaysia", "default_prereq_min_grade": "C"}]),
        # 3. existing degree_templates check
        MagicMock(data=[]),
        # 4. degree_templates insert succeeds
        MagicMock(data=[{"id": "tmpl-uuid-rollback"}]),
        # 5. template_courses insert fails
        Exception("DB connection dropped"),
        # 6. rollback delete execute
        MagicMock(data=[{"id": "tmpl-uuid-rollback"}])
    ]

    csv_data = b"course_code,course_name,credits,category,prerequisites\nSECJ1013,PT1,3,Core,None\n"

    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Software Engineering 2024/2025",
        "program_code": "SECJ",
        "syllabus_year": "2024/2025",
        "total_credits": 130
    }, files={"file": ("curriculum.csv", csv_data, "text/csv")})

    assert response.status_code == 500

    # Verify template was deleted for rollback
    mock_query.delete.assert_called_once()
    mock_query.eq.assert_called_with("id", "tmpl-uuid-rollback")
