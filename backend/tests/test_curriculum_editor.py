import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.app.main import app
from backend.app.core.auth import verify_advisor_jwt
from backend.app.engine.parsers.csv_course_parser import CSVCourseParser

client = TestClient(app)


def create_mock_supabase():
    mock_svc = MagicMock()
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.single.return_value = mock_query
    mock_query.insert.return_value = mock_query
    mock_query.update.return_value = mock_query
    mock_query.delete.return_value = mock_query
    mock_svc.client.table.return_value = mock_query
    return mock_svc, mock_query


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


# =============================================================================
# 1. SHARED VALIDATOR TESTS
# =============================================================================

def test_shared_validator_same_error_csv_and_editor():
    """
    Test requirement: shared validator used by both paths
    (same error message for a bad course code via CSV and via editor).
    """
    bad_code = "SECJ@1013"
    
    # Direct validation test
    _, direct_errors = CSVCourseParser.validate_course_row(
        code=bad_code,
        name="Invalid Course",
        credits=3,
        category="Core"
    )
    assert len(direct_errors) == 1
    expected_error_substr = f"Invalid course code '{bad_code}'. Must contain only alphanumeric characters."
    assert expected_error_substr in direct_errors[0]

    # CSV path test
    csv_text = (
        "course_code,course_name,credits,category,prerequisites\n"
        f"{bad_code},Invalid Course,3,Core,None\n"
    )
    _, csv_errors = CSVCourseParser.parse_csv_content(csv_text)
    assert len(csv_errors) == 1
    assert expected_error_substr in csv_errors[0]
    assert "Row 2:" in csv_errors[0]


@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_editor_endpoint_uses_shared_validator_422(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # 1. advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # 2. degree_templates lookup (write access)
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM", "owner_staff_id": "STAFF-001"}]),
        # 3. tenants lookup (default_prereq_min_grade)
        MagicMock(data=[{"default_prereq_min_grade": "C"}]),
        # 4. existing real course codes
        MagicMock(data=[])
    ]

    response = client.post("/api/v1/courses/templates/tmpl-1/rows", json={
        "course_code": "SECJ@1013",
        "course_name": "Invalid Course",
        "credit_hour": 3,
        "category": "Core"
    })

    assert response.status_code == 422
    assert "Invalid course code 'SECJ@1013'. Must contain only alphanumeric characters." in response.json()["detail"]


# =============================================================================
# 2. OWNERSHIP & TENANT 403 TESTS
# =============================================================================

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_template_write_non_owner_403(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor2@utm.my"
    }

    # Advisor is STAFF-002, template owner is STAFF-001
    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-002"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM", "owner_staff_id": "STAFF-001"}])
    ]

    response = client.patch("/api/v1/courses/templates/tmpl-1", json={
        "program_name": "Renamed Template"
    })

    assert response.status_code == 403
    assert "Only the uploader can edit this template" in response.json()["detail"]


@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_template_write_null_owner_403(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    # Template has owner_staff_id = NULL
    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM", "owner_staff_id": None}])
    ]

    response = client.post("/api/v1/courses/templates/tmpl-1/rows", json={
        "course_code": "SECJ1013",
        "course_name": "Programming Technique I",
        "credit_hour": 3,
        "category": "Core"
    })

    assert response.status_code == 403
    assert "Template has no owner; contact support" in response.json()["detail"]


@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_template_other_tenant_403(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    # Advisor belongs to UTM, template belongs to UKM
    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UKM", "owner_staff_id": "STAFF-001"}])
    ]

    response = client.get("/api/v1/courses/templates/tmpl-1")

    assert response.status_code == 403
    assert "belongs to another institution" in response.json()["detail"]


# =============================================================================
# 3. ROW VALIDATION (DUPLICATE CODE & BAD CREDITS 422)
# =============================================================================

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_add_duplicate_course_code_422(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM", "owner_staff_id": "STAFF-001"}]),
        # tenants lookup
        MagicMock(data=[{"default_prereq_min_grade": "C"}]),
        # existing courses in template
        MagicMock(data=[{"course_code": "SECJ1013", "is_elective_slot": False}])
    ]

    response = client.post("/api/v1/courses/templates/tmpl-1/rows", json={
        "course_code": "SECJ1013",
        "course_name": "Programming Technique I Duplicate",
        "credit_hour": 3,
        "category": "Core"
    })

    assert response.status_code == 422
    assert "Duplicate course code 'SECJ1013'" in response.json()["detail"]


@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_add_bad_credits_422(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM", "owner_staff_id": "STAFF-001"}]),
        # tenants lookup
        MagicMock(data=[{"default_prereq_min_grade": "C"}]),
        # existing courses in template
        MagicMock(data=[])
    ]

    response = client.post("/api/v1/courses/templates/tmpl-1/rows", json={
        "course_code": "SECJ2013",
        "course_name": "Data Structures",
        "credit_hour": 0,
        "category": "Core"
    })

    assert response.status_code == 422
    assert "Must be positive" in response.json()["detail"]


# =============================================================================
# 4. DELETE CASCADES OVERRIDES & SLOT RENUMBERING
# =============================================================================

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_delete_cascades_overrides_and_returns_count(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM", "owner_staff_id": "STAFF-001"}]),
        # template_courses row lookup
        MagicMock(data=[{"id": "slot-uuid-2", "is_elective_slot": True}]),
        # elective_assignments count query
        MagicMock(data=[{"id": "ea-1"}, {"id": "ea-2"}]),
        # elective_assignments delete
        MagicMock(data=[]),
        # template_courses delete
        MagicMock(data=[]),
        # _renumber_template_slots: query remaining elective slots
        MagicMock(data=[
            {"id": "slot-uuid-1", "slot_no": 1, "created_at": "2026-01-01T00:00:00Z"},
            {"id": "slot-uuid-3", "slot_no": 3, "created_at": "2026-01-03T00:00:00Z"}
        ]),
        # _renumber_template_slots: update slot-uuid-3 to slot_no = 2
        MagicMock(data=[{"id": "slot-uuid-3", "slot_no": 2}])
    ]

    response = client.delete("/api/v1/courses/templates/tmpl-1/rows/slot-uuid-2")

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["deleted"] is True
    assert res_data["row_id"] == "slot-uuid-2"
    assert res_data["cascaded_overrides_count"] == 2


# =============================================================================
# 5. UPLOAD CSV SETS OWNER_STAFF_ID FROM JWT ADVISOR
# =============================================================================

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_upload_csv_sets_owner_staff_id_from_jwt(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "advisor-jwt-sub-123",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # advisors lookup with staff_id
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-XYZ-777"}]),
        # tenants lookup
        MagicMock(data=[{"name": "Universiti Teknologi Malaysia", "default_prereq_min_grade": "C"}]),
        # duplicate template check
        MagicMock(data=[]),
        # degree_templates insert
        MagicMock(data=[{"id": "tmpl-created-uuid"}]),
        # template_courses insert
        MagicMock(data=[{"id": "tc-1"}])
    ]

    csv_data = b"course_code,course_name,credits,category,prerequisites\nSECJ1013,Programming Technique I,3,Core,None\n"

    response = client.post("/api/v1/courses/upload-csv", data={
        "template_name": "Software Engineering 2026/2027",
        "program_code": "SECJ",
        "syllabus_year": "2026/2027",
        "total_credits": 130
    }, files={"file": ("curriculum.csv", csv_data, "text/csv")})

    assert response.status_code == 200
    assert response.json()["template_id"] == "tmpl-created-uuid"

    # Verify template insert payload received owner_staff_id from advisor row
    tmpl_insert_call = mock_query.insert.call_args_list[0][0][0]
    assert tmpl_insert_call["owner_staff_id"] == "STAFF-XYZ-777"
    assert tmpl_insert_call["tenant_id"] == "UTM"


# =============================================================================
# 6. IMPACT & LIST TEMPLATES
# =============================================================================

@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_get_template_row_impact(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates lookup
        MagicMock(data=[{"id": "tmpl-1", "tenant_id": "UTM"}]),
        # template_courses row lookup
        MagicMock(data=[{"id": "row-1"}]),
        # elective_assignments count
        MagicMock(data=[{"id": "ea-1"}, {"id": "ea-2"}, {"id": "ea-3"}]),
        # cohorts count
        MagicMock(data=[{"id": "c-1"}, {"id": "c-2"}])
    ]

    response = client.get("/api/v1/courses/templates/tmpl-1/rows/row-1/impact")

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["overrides_count"] == 3
    assert res_data["cohorts_using_template"] == 2


@patch("backend.app.v1.endpoints.courses.SupabaseService")
def test_list_templates_can_edit_flag(mock_supabase_class):
    mock_svc, mock_query = create_mock_supabase()
    mock_supabase_class.return_value = mock_svc

    app.dependency_overrides[verify_advisor_jwt] = lambda: {
        "sub": "mock-advisor-uid",
        "email": "advisor@utm.my"
    }

    mock_query.execute.side_effect = [
        # advisors lookup
        MagicMock(data=[{"tenant_id": "UTM", "staff_id": "STAFF-001"}]),
        # degree_templates query
        MagicMock(data=[
            {
                "id": "tmpl-1",
                "program_code": "SECJ",
                "program_name": "Software Engineering",
                "syllabus_year": "2024/2025",
                "total_credits_required": 130,
                "owner_staff_id": "STAFF-001"
            },
            {
                "id": "tmpl-2",
                "program_code": "SECR",
                "program_name": "Networks & Security",
                "syllabus_year": "2024/2025",
                "total_credits_required": 132,
                "owner_staff_id": "STAFF-002"
            }
        ])
    ]

    response = client.get("/api/v1/courses/templates")

    assert response.status_code == 200
    templates = response.json()
    assert len(templates) == 2
    assert templates[0]["id"] == "tmpl-1"
    assert templates[0]["can_edit"] is True
    assert templates[1]["id"] == "tmpl-2"
    assert templates[1]["can_edit"] is False
