"""
Tests for the requirement matching engine (4A) and the /audit/progress endpoint.

Pure-function tests use no network. Endpoint tests use the fake-DB pattern
from test_document_ownership.py.
"""
import sys
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from unittest.mock import patch

try:
    from app.main import app
    from app.core.auth import verify_advisor_jwt
    import app.v1.endpoints.audit as audit_mod
    from app.engine.progress import compute_progress, _build_pattern_regex, _code_matches_pattern
    from app.engine.grading import GradingScale, GradeDefinition
    from app.engine.parsers.csv_course_parser import CSVCourseParser
except ImportError:
    from backend.app.main import app
    from backend.app.core.auth import verify_advisor_jwt
    import backend.app.v1.endpoints.audit as audit_mod
    from backend.app.engine.progress import compute_progress, _build_pattern_regex, _code_matches_pattern
    from backend.app.engine.grading import GradingScale, GradeDefinition
    from backend.app.engine.parsers.csv_course_parser import CSVCourseParser

# =============================================================================
# Fixtures
# =============================================================================

UTM_GRADES = [
    GradeDefinition("A",  4.00, 1,  True,  True,  True),
    GradeDefinition("A-", 3.67, 2,  True,  True,  True),
    GradeDefinition("B+", 3.33, 3,  True,  True,  True),
    GradeDefinition("B",  3.00, 4,  True,  True,  True),
    GradeDefinition("C+", 2.33, 5,  True,  True,  True),
    GradeDefinition("C",  2.00, 6,  True,  True,  True),
    GradeDefinition("D",  1.00, 7,  True,  True,  True),
    GradeDefinition("E",  0.00, 8,  False, True,  False),
    GradeDefinition("F",  0.00, 9,  False, True,  False),
    GradeDefinition("TD", 0.00, None, False, False, False),
    GradeDefinition("EX", None, None, True,  False, True),   # exemption
    GradeDefinition("HL", None, None, True,  False, True),   # pass non-graded
]

@pytest.fixture
def scale():
    return GradingScale("UTM", UTM_GRADES)


def _core(id_, code, name="Course", credits=3, category="Core"):
    return {
        "id": id_, "course_code": code, "course_name": name,
        "credit_hour": credits, "category": category,
        "is_elective_slot": False, "slot_no": None, "match_patterns": None,
    }


def _slot(id_, code, patterns, slot_no=1, name="Elective Slot", credits=3, category="Elective"):
    return {
        "id": id_, "course_code": code, "course_name": name,
        "credit_hour": credits, "category": category,
        "is_elective_slot": True, "slot_no": slot_no, "match_patterns": patterns,
    }


def _rec(code, grade, credits=3, semester="SEM 1 2023/2024", status="Passed"):
    return {
        "course_code": code, "grade": grade, "credits": credits,
        "semester": semester, "status": status, "course_name": code,
    }


# =============================================================================
# Pattern regex unit tests
# =============================================================================

def test_pattern_xx_matches_two_chars():
    rx = _build_pattern_regex("SCSRXX")
    assert rx.match("SCSRAB")
    assert not rx.match("SCSR1")    # only 1 char after prefix
    assert not rx.match("SCST12")   # wrong prefix

def test_pattern_xxx_matches_three_chars():
    rx = _build_pattern_regex("SCSRXXX3")
    assert rx.match("SCSR2213")
    assert not rx.match("SCST2213")   # different prefix

def test_single_x_is_literal():
    """A lone X must not act as wildcard (csv_course_parser detects 'XX' for slots)."""
    rx = _build_pattern_regex("SCRX1")
    assert rx.match("SCRX1something")   # literal X matched
    assert not rx.match("SCRA1something")

def test_pattern_prefix_not_full_match():
    """Patterns are prefix matches — longer codes are still accepted."""
    assert _code_matches_pattern("SCSR2213", "SCSRXXX3")
    assert _code_matches_pattern("SCSR221", "SCSRXXX")   # 3-char wildcard, 3-char suffix

def test_pattern_rejects_wrong_prefix():
    assert not _code_matches_pattern("SCST1223", "SCSRXXX3")


# =============================================================================
# Pure-function engine tests
# =============================================================================

class TestCoreExactMatch:
    def test_passing_course_satisfied(self, scale):
        template = [_core("t1", "SCSR2213")]
        records = [_rec("SCSR2213", "C+")]
        result = compute_progress(template, records, scale)
        assert result["rows"][0]["status"] == "done"
        assert result["rows"][0]["source"] == "exact"
        assert result["rows"][0]["satisfied_by"]["course_code"] == "SCSR2213"

    def test_failed_attempt_does_not_count(self, scale):
        template = [_core("t1", "SCSR2213")]
        records = [_rec("SCSR2213", "F")]   # F = not counts_as_completed
        result = compute_progress(template, records, scale)
        assert result["rows"][0]["status"] == "missing"
        assert result["rows"][0]["satisfied_by"] is None

    def test_missing_course_is_missing(self, scale):
        template = [_core("t1", "SCSR9999")]
        result = compute_progress(template, [], scale)
        assert result["rows"][0]["status"] == "missing"


class TestRepeatPolicy:
    def test_latest_policy_picks_last_attempt(self, scale):
        template = [_core("t1", "SCSR2213")]
        records = [
            _rec("SCSR2213", "C+", semester="SEM 1 2022/2023"),
            _rec("SCSR2213", "A",  semester="SEM 1 2023/2024"),  # later
        ]
        result = compute_progress(template, records, scale, repeat_policy="latest")
        row = result["rows"][0]
        assert row["status"] == "done"
        assert row["satisfied_by"]["grade"] == "A"

    def test_best_policy_picks_best_grade(self, scale):
        template = [_core("t1", "SCSR2213")]
        records = [
            _rec("SCSR2213", "A",  semester="SEM 1 2022/2023"),
            _rec("SCSR2213", "C+", semester="SEM 1 2023/2024"),  # later but worse
        ]
        result = compute_progress(template, records, scale, repeat_policy="best")
        row = result["rows"][0]
        assert row["status"] == "done"
        assert row["satisfied_by"]["grade"] == "A"

    def test_failed_attempt_with_later_pass(self, scale):
        """Latest policy: earlier fail, later pass → row is done."""
        template = [_core("t1", "SCSR2213")]
        records = [
            _rec("SCSR2213", "F",  semester="SEM 1 2022/2023"),
            _rec("SCSR2213", "C+", semester="SEM 1 2023/2024"),
        ]
        result = compute_progress(template, records, scale, repeat_policy="latest")
        assert result["rows"][0]["status"] == "done"


class TestSlotPatternMatch:
    def test_slot_matches_correct_prefix(self, scale):
        """SCSRXXX3 slot should be filled by SCSR2213 (C+, passing)."""
        template = [_slot("s1", "SCSRXXX3", ["SCSRXXX3"])]
        records = [_rec("SCSR2213", "C+")]
        result = compute_progress(template, records, scale)
        assert result["rows"][0]["status"] == "done"
        assert result["rows"][0]["source"] == "pattern"
        assert result["rows"][0]["satisfied_by"]["course_code"] == "SCSR2213"

    def test_slot_rejects_wrong_prefix(self, scale):
        """SCSRXXX3 slot must NOT be filled by SCST1223."""
        template = [_slot("s1", "SCSRXXX3", ["SCSRXXX3"])]
        records = [_rec("SCST1223", "C+")]
        result = compute_progress(template, records, scale)
        assert result["rows"][0]["status"] == "missing"
        assert len(result["unassigned"]) == 1

    def test_two_slots_three_candidates_no_double_use(self, scale):
        """
        Slots: slot1=SCSRXXX3, slot2=SCSRXXX3
        Courses: SCSR2213 C+, SCSR3233 B, SCST1223 C+

        SCST1223 doesn't match SCSR pattern.
        SCSR2213 and SCSR3233 each fill one slot (greedy, order-stable).
        SCST1223 is unassigned.
        """
        template = [
            _slot("s1", "SCSRXXX3", ["SCSRXXX3"], slot_no=1),
            _slot("s2", "SCSRXXX3", ["SCSRXXX3"], slot_no=2),
        ]
        records = [
            _rec("SCSR2213", "C+"),
            _rec("SCSR3233", "B"),
            _rec("SCST1223", "C+"),
        ]
        result = compute_progress(template, records, scale)
        done_rows = [r for r in result["rows"] if r["status"] == "done"]
        assert len(done_rows) == 2
        used = {r["satisfied_by"]["course_code"] for r in done_rows}
        assert "SCSR2213" in used
        assert "SCSR3233" in used
        # No course fills more than one row
        assert len(used) == 2
        # SCST1223 should be unassigned
        assert any(u["course_code"] == "SCST1223" for u in result["unassigned"])


class TestUnassignedAndCategories:
    def test_unassigned_courses_listed(self, scale):
        template = [_core("t1", "SCSR2213")]
        records = [_rec("SCSR2213", "C+"), _rec("ULRS1182", "A", credits=2)]
        result = compute_progress(template, records, scale)
        assert result["rows"][0]["status"] == "done"
        assert len(result["unassigned"]) == 1
        assert result["unassigned"][0]["course_code"] == "ULRS1182"

    def test_category_sums_use_template_credits_for_core(self, scale):
        """required = template credits; earned = template credits of satisfied rows."""
        template = [
            _core("t1", "SCSR2213", credits=3, category="Core"),
            _core("t2", "SCST1223", credits=3, category="Core"),
        ]
        records = [_rec("SCSR2213", "A"), _rec("SCST1223", "C+")]
        result = compute_progress(template, records, scale)
        cat = next(c for c in result["categories"] if c["category"] == "Core")
        assert cat["required"] == 6
        assert cat["earned"] == 6

    def test_category_earned_zero_when_not_satisfied(self, scale):
        template = [_core("t1", "SCSR9999", credits=3, category="Core")]
        result = compute_progress(template, [], scale)
        cat = result["categories"][0]
        assert cat["required"] == 3
        assert cat["earned"] == 0

    def test_credit_mismatch_warning_core(self, scale):
        """Template says 3cr, record says 4cr — warning emitted, template credits used."""
        template = [_core("t1", "SCSR2213", credits=3)]
        records = [_rec("SCSR2213", "A", credits=4)]
        result = compute_progress(template, records, scale)
        assert result["rows"][0]["status"] == "done"
        assert result["rows"][0]["credits"] == 3   # template wins for core
        assert any("mismatch" in w.lower() for w in result["warnings"])


class TestOverrides:
    def test_assign_outside_pattern_gets_warning(self, scale):
        """Assign outside pattern fills slot, sets source='override', and adds warning."""
        template = [_slot("s1", "SCSRXXX3", ["SCSRXXX3"], slot_no=1)]
        records = [_rec("SKEU1013", "A", credits=3)]
        overrides = [{
            "kind": "assign",
            "template_course_id": "s1",
            "course_code": "SKEU1013",
            "note": "Dean approval for faculty elective",
            "assigned_by_staff_id": "ADV01"
        }]
        result = compute_progress(template, records, scale, overrides=overrides)
        row = result["rows"][0]
        assert row["status"] == "done"
        assert row["source"] == "override"
        assert row["satisfied_by"]["course_code"] == "SKEU1013"
        assert row["override"]["kind"] == "assign"
        assert row["override"]["note"] == "Dean approval for faculty elective"
        assert any("SLOT filled by advisor override outside its pattern" in w for w in result["warnings"])

    def test_exclude_removes_course_from_auto_matching(self, scale):
        """Exclude removes passing course (e.g. UHLB1112 with grade HL) from matching; listed in unassigned."""
        template = [_slot("s1", "UHLBXXXX", ["UHLBXXXX"], slot_no=1)]
        records = [_rec("UHLB1112", "HL", credits=2)]
        overrides = [{
            "kind": "exclude",
            "course_code": "UHLB1112",
            "note": "Taken for co-curricular only",
            "assigned_by_staff_id": "ADV01"
        }]
        result = compute_progress(template, records, scale, overrides=overrides)
        assert result["rows"][0]["status"] == "missing"
        assert len(result["unassigned"]) == 1
        unassigned_course = result["unassigned"][0]
        assert unassigned_course["course_code"] == "UHLB1112"
        assert unassigned_course["excluded"] is True
        assert unassigned_course["override"]["kind"] == "exclude"
        assert unassigned_course["override"]["note"] == "Taken for co-curricular only"

    def test_stale_override_is_ignored_with_warning(self, scale):
        """If an override points at a course that is no longer passing/counted, ignore it with warning and let slot auto-match."""
        template = [_slot("s1", "SCSRXXX3", ["SCSRXXX3"], slot_no=1)]
        records = [_rec("SCSR2213", "B", credits=3)]
        overrides = [{
            "kind": "assign",
            "template_course_id": "s1",
            "course_code": "NONEXISTENT",
        }]
        result = compute_progress(template, records, scale, overrides=overrides)
        row = result["rows"][0]
        assert row["status"] == "done"
        assert row["source"] == "pattern"
        assert row["satisfied_by"]["course_code"] == "SCSR2213"
        assert any("ignoring override" in w.lower() for w in result["warnings"])

    def test_assign_override_beats_bipartite_result(self, scale):
        """An assign override beats the bipartite matching result and pins the course."""
        slots = [
            _slot("slot-1", "SCSRXXX3", ["SCSRXXX3"], slot_no=1),
            _slot("slot-2", "XXXXXXX3", ["XXXXXXX3"], slot_no=2),
        ]
        records = [
            _rec("SCSR2213", "B"),
            _rec("SKEU1013", "A"),
        ]
        # Override pins SKEU1013 to slot-1 (Free Elective course pinned to SCSR slot)
        overrides = [{
            "kind": "assign",
            "template_course_id": "slot-1",
            "course_code": "SKEU1013",
        }]
        res = compute_progress(slots, records, scale, overrides=overrides)
        r_by_id = {r["template_course_id"]: r for r in res["rows"]}
        assert r_by_id["slot-1"]["status"] == "done"
        assert r_by_id["slot-1"]["source"] == "override"
        assert r_by_id["slot-1"]["satisfied_by"]["course_code"] == "SKEU1013"
        # slot-2 auto-matches SCSR2213
        assert r_by_id["slot-2"]["status"] == "done"
        assert r_by_id["slot-2"]["source"] == "pattern"
        assert r_by_id["slot-2"]["satisfied_by"]["course_code"] == "SCSR2213"


class TestTotals:
    def test_totals_match_categories(self, scale):
        template = [
            _core("t1", "SCSR2213", credits=3, category="Core"),
            _slot("s1", "SCSRXXX3", ["SCSRXXX3"], slot_no=1, credits=3, category="Elective"),
        ]
        records = [_rec("SCSR2213", "A"), _rec("SCSR3233", "B")]
        result = compute_progress(template, records, scale)
        assert result["totals"]["required"] == 6
        assert result["totals"]["earned"] == 6


# =============================================================================
# Endpoint tests (fake DB)
# =============================================================================

class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters = db, table, {}
        self._action = "select"
        self._payload = None

    def select(self, *_a, **_k):
        self._action = "select"
        return self

    def insert(self, payload):
        self._action = "insert"
        self._payload = payload
        return self

    def delete(self):
        self._action = "delete"
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def limit(self, *_a):
        return self

    def execute(self):
        table_rows = self.db.setdefault(self.table, [])
        if self._action == "select":
            rows = [r for r in table_rows if all(r.get(k) == v for k, v in self.filters.items())]
            return type("Res", (), {"data": rows})()
        elif self._action == "delete":
            deleted = []
            remaining = []
            for r in table_rows:
                if all(r.get(k) == v for k, v in self.filters.items()):
                    deleted.append(r)
                else:
                    remaining.append(r)
            self.db[self.table] = remaining
            return type("Res", (), {"data": deleted})()
        elif self._action == "insert":
            new_rows = self._payload if isinstance(self._payload, list) else [self._payload]
            for row in new_rows:
                r_copy = dict(row)
                if "id" not in r_copy:
                    r_copy["id"] = "gen-uuid"
                table_rows.append(r_copy)
            return type("Res", (), {"data": new_rows})()
        return type("Res", (), {"data": []})()


class _FakeClient:
    def __init__(self, db): self.db = db
    def table(self, name): return _Query(self.db, name)


def _endpoint_db():
    return {
        "students": [{
            "matric_no": "A24MJ5050", "user_id": "stu-uid",
            "advisor_staff_id": "TEST123", "tenant_id": "UTM",
            "cohort_id": "cohort-1",
        }, {
            "matric_no": "A24MJ9999", "user_id": "stu-other",
            "advisor_staff_id": "OTHER1", "tenant_id": "UTM",
            "cohort_id": "cohort-1",
        }],
        "advisors": [
            {"user_id": "adv-uid", "staff_id": "TEST123", "tenant_id": "UTM"},
            {"user_id": "non-adv",  "staff_id": "OTHER9",  "tenant_id": "UTM"},
        ],
        "cohorts": [
            {"id": "cohort-1", "template_id": "tmpl-1"},
            {"id": "cohort-other", "template_id": "tmpl-other"},
        ],
        "degree_templates": [
            {"id": "tmpl-1", "total_credits_required": 130},
            {"id": "tmpl-other", "total_credits_required": 130},
        ],
        "template_courses": [
            {
                "id": "tc-1", "template_id": "tmpl-1",
                "course_code": "SCSR2213", "course_name": "Data Structures",
                "credit_hour": 3, "category": "Core",
                "is_elective_slot": False, "slot_no": None, "match_patterns": None,
            },
            {
                "id": "tc-slot-1", "template_id": "tmpl-1",
                "course_code": "SCSRXXX3", "course_name": "Elective Slot 1",
                "credit_hour": 3, "category": "Elective",
                "is_elective_slot": True, "slot_no": 1, "match_patterns": ["SCSRXXX3"],
            },
            {
                "id": "tc-slot-2", "template_id": "tmpl-1",
                "course_code": "XXXXXXX3", "course_name": "Free Elective Slot 2",
                "credit_hour": 3, "category": "Elective",
                "is_elective_slot": True, "slot_no": 2, "match_patterns": ["XXXXXXX3"],
            },
            {
                "id": "tc-other-slot", "template_id": "tmpl-other",
                "course_code": "OTHERXXX", "course_name": "Other Template Slot",
                "credit_hour": 3, "category": "Elective",
                "is_elective_slot": True, "slot_no": 1, "match_patterns": ["OTHERXXX"],
            },
        ],
        "academic_records": [
            {"course_code": "SCSR2213", "grade": "A", "credits": 3,
             "semester": "SEM 1 2023/2024", "status": "Passed",
             "course_name": "Data Structures", "tenant_id": "UTM", "matric_no": "A24MJ5050"},
            {"course_code": "SKEU1013", "grade": "B", "credits": 3,
             "semester": "SEM 2 2023/2024", "status": "Passed",
             "course_name": "Circuit Theory", "tenant_id": "UTM", "matric_no": "A24MJ5050"},
            {"course_code": "UHLB1112", "grade": "HL", "credits": 2,
             "semester": "SEM 2 2023/2024", "status": "Passed",
             "course_name": "English", "tenant_id": "UTM", "matric_no": "A24MJ5050"},
            {"course_code": "FAIL1013", "grade": "E", "credits": 3,
             "semester": "SEM 1 2023/2024", "status": "Failed",
             "course_name": "Failed Course", "tenant_id": "UTM", "matric_no": "A24MJ5050"},
        ],
        "elective_assignments": [],
        "tenants": [{"id": "UTM", "repeat_policy": "latest"}],
        "grade_scales": UTM_GRADES_ROWS,
    }


# Minimal grade_scales rows for load_scale
UTM_GRADES_ROWS = [
    {"grade": g.grade, "points": g.points, "rank": g.rank,
     "is_pass": g.is_pass, "counts_in_cgpa": g.counts_in_cgpa,
     "counts_as_completed": g.counts_as_completed,
     "tenant_id": "UTM", "effective_from": None, "effective_to": None,
     "min_mark": None, "max_mark": None, "achievement_label": None}
    for g in UTM_GRADES
]


@pytest.fixture(autouse=True)
def _restore_auth_override_progress():
    saved = app.dependency_overrides.get(verify_advisor_jwt)
    yield
    if saved is not None:
        app.dependency_overrides[verify_advisor_jwt] = saved
    else:
        app.dependency_overrides.pop(verify_advisor_jwt, None)


@pytest.fixture
def fake_db_progress():
    db = _endpoint_db()
    with patch.object(audit_mod.supabase_svc, "client", _FakeClient(db)):
        yield db


def _client_as(sub):
    app.dependency_overrides[verify_advisor_jwt] = lambda: {"sub": sub, "app_metadata": {}}
    return TestClient(app)


# Patch load_scale to avoid hitting DB
@pytest.fixture(autouse=True)
def _patch_load_scale():
    scale = GradingScale("UTM", UTM_GRADES)
    with patch("backend.app.engine.progress.GradingScale", wraps=GradingScale):
        try:
            target = "app.v1.endpoints.audit.load_scale"
            with patch(target, return_value=scale):
                yield
        except Exception:
            target = "backend.app.v1.endpoints.audit.load_scale"
            with patch(target, return_value=scale):
                yield


def test_progress_student_own_200(fake_db_progress):
    c = _client_as("stu-uid")
    res = c.get("/api/v1/audit/progress/A24MJ5050")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["matric_no"] == "A24MJ5050"
    assert "rows" in body and "categories" in body


def test_progress_timing_logs_info(fake_db_progress, caplog):
    import logging
    caplog.set_level(logging.INFO)
    c = _client_as("stu-uid")
    res = c.get("/api/v1/audit/progress/A24MJ5050")
    assert res.status_code == 200, res.text
    log_text = caplog.text
    assert "[Progress] A24MJ5050 Stage 1" in log_text
    assert "[Progress] A24MJ5050 Stage 2" in log_text
    assert "[Progress] A24MJ5050 Stage 3" in log_text



def test_progress_other_student_403(fake_db_progress):
    c = _client_as("stu-other")
    res = c.get("/api/v1/audit/progress/A24MJ5050")
    assert res.status_code == 403


def test_progress_advisor_non_advisee_403(fake_db_progress):
    c = _client_as("non-adv")
    res = c.get("/api/v1/audit/progress/A24MJ5050")
    assert res.status_code == 403


def test_progress_no_template_409(fake_db_progress):
    # Remove template_courses so the endpoint hits the 409
    fake_db_progress["template_courses"] = []
    c = _client_as("stu-uid")
    res = c.get("/api/v1/audit/progress/A24MJ5050")
    assert res.status_code == 409


def test_override_advisor_non_advisee_403(fake_db_progress):
    c = _client_as("non-adv")
    res = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "SKEU1013",
        "template_course_id": "tc-slot-1"
    })
    assert res.status_code == 403


def test_override_student_put_403(fake_db_progress):
    c = _client_as("stu-uid")
    res = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "SKEU1013",
        "template_course_id": "tc-slot-1"
    })
    assert res.status_code == 403


def test_override_course_not_passed_422(fake_db_progress):
    c = _client_as("adv-uid")
    # FAIL1013 has grade 'E' (not pass)
    res = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "FAIL1013",
        "template_course_id": "tc-slot-1"
    })
    assert res.status_code == 422

    # NOTTAKEN is not in records
    res2 = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "NOTTAKEN",
        "template_course_id": "tc-slot-1"
    })
    assert res2.status_code == 422


def test_override_assign_to_core_row_422(fake_db_progress):
    c = _client_as("adv-uid")
    # SCSR2213 is a core row in template tmpl-1
    res = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "SCSR2213",
        "template_course_id": "tc-slot-1"
    })
    assert res.status_code == 422


def test_override_assign_to_slot_from_another_template_422(fake_db_progress):
    c = _client_as("adv-uid")
    # tc-other-slot belongs to tmpl-other, student is in tmpl-1
    res = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "SKEU1013",
        "template_course_id": "tc-other-slot"
    })
    assert res.status_code == 422


def test_override_upsert_replaces(fake_db_progress):
    c = _client_as("adv-uid")
    # 1. Assign SKEU1013 to Free Elective slot tc-slot-2
    res1 = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "SKEU1013",
        "template_course_id": "tc-slot-2",
        "note": "First note"
    })
    assert res1.status_code == 200

    # 2. Check progress reflects SKEU1013 in tc-slot-2
    prog1 = c.get("/api/v1/audit/progress/A24MJ5050").json()
    slot2_row = next(r for r in prog1["rows"] if r["template_course_id"] == "tc-slot-2")
    assert slot2_row["source"] == "override"
    assert slot2_row["satisfied_by"]["course_code"] == "SKEU1013"

    # 3. Replace slot assignment with UHLB1112
    res2 = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "UHLB1112",
        "template_course_id": "tc-slot-2",
        "note": "Replaced assignment"
    })
    assert res2.status_code == 200

    # 4. Check progress reflects UHLB1112 in tc-slot-2 and SKEU1013 is unassigned
    prog2 = c.get("/api/v1/audit/progress/A24MJ5050").json()
    slot2_row_updated = next(r for r in prog2["rows"] if r["template_course_id"] == "tc-slot-2")
    assert slot2_row_updated["source"] == "override"
    assert slot2_row_updated["satisfied_by"]["course_code"] == "UHLB1112"
    assert any(u["course_code"] == "SKEU1013" for u in prog2["unassigned"])


def test_override_delete_restores_auto(fake_db_progress):
    c = _client_as("adv-uid")
    # Assign SKEU1013 to slot-1 (SCSR slot, outside pattern)
    res = c.put("/api/v1/audit/progress/A24MJ5050/overrides", json={
        "kind": "assign",
        "course_code": "SKEU1013",
        "template_course_id": "tc-slot-1",
    })
    assert res.status_code == 200

    # DELETE the override
    del_res = c.delete("/api/v1/audit/progress/A24MJ5050/overrides/SKEU1013")
    assert del_res.status_code == 200

    # Verify progress restored to auto-matching
    prog = c.get("/api/v1/audit/progress/A24MJ5050").json()
    slot1_row = next(r for r in prog["rows"] if r["template_course_id"] == "tc-slot-1")
    # SKEU1013 does not match SCSRXXX3, so slot 1 is missing and not override
    assert slot1_row["source"] != "override"


class TestBipartiteSlotMatching:
    def test_bipartite_specific_beats_broad(self, scale):
        """
        Test a: slots [SXXXXXX3 (slot 1), "SCSE3143/SCSR3113" (slot 2)],
        courses [SCSE3143, SKEU1013] -> slot 2 = SCSE3143, slot 1 = SKEU1013.
        """
        slots = [
            _slot("slot-1", "SXXXXXX3", ["SXXXXXX3"], slot_no=1),
            _slot("slot-2", "SCSE3143/SCSR3113", ["SCSE3143", "SCSR3113"], slot_no=2),
        ]
        records = [
            _rec("SCSE3143", "C+"),
            _rec("SKEU1013", "C+"),
        ]
        res = compute_progress(slots, records, scale)
        r_by_id = {r["template_course_id"]: r for r in res["rows"]}

        assert r_by_id["slot-2"]["status"] == "done"
        assert r_by_id["slot-2"]["satisfied_by"]["course_code"] == "SCSE3143"

        assert r_by_id["slot-1"]["status"] == "done"
        assert r_by_id["slot-1"]["satisfied_by"]["course_code"] == "SKEU1013"

        assert res["unassigned"] == []

    def test_single_course_fills_specific_slot_not_broad(self, scale):
        """A course must never fill a broad slot if that leaves a more specific slot empty."""
        slots = [
            _slot("slot-1", "SXXXXXX3", ["SXXXXXX3"], slot_no=1),
            _slot("slot-2", "SCSE3143/SCSR3113", ["SCSE3143", "SCSR3113"], slot_no=2),
        ]
        records = [
            _rec("SCSE3143", "C+"),
        ]
        res = compute_progress(slots, records, scale)
        r_by_id = {r["template_course_id"]: r for r in res["rows"]}

        assert r_by_id["slot-2"]["status"] == "done"
        assert r_by_id["slot-2"]["satisfied_by"]["course_code"] == "SCSE3143"

        assert r_by_id["slot-1"]["status"] == "missing"
        assert r_by_id["slot-1"]["satisfied_by"] is None


class TestMinCreditsPrereqParsing:
    def test_min_credits_only_prerequisite_row(self):
        """Test b: A min_credits-only prerequisite row still parses."""
        res1 = CSVCourseParser.parse_prerequisite_string("min_credits: 80")
        assert res1["min_credits"] == 80
        assert res1["courses"] == []

        res2 = CSVCourseParser.parse_prerequisite_string("credits: 90")
        assert res2["min_credits"] == 90
        assert res2["courses"] == []

        res3 = CSVCourseParser.parse_prerequisite_string("jam kredit: 80")
        assert res3["min_credits"] == 80
        assert res3["courses"] == []


class TestEngineWarningTemplateCredits:
    def test_template_total_credits_mismatch_warning(self, scale):
        """Warning generated when template rows credit sum != template_total_credits."""
        rows = [
            _core("c-1", "SCSR2213", credits=3),
            _core("c-2", "ULRS1182", credits=2),
        ]
        res = compute_progress(rows, [], scale, template_total_credits=130)
        assert any("Template rows total 5 credits but programme requires 130." in w for w in res["warnings"])

    def test_template_total_credits_match_no_warning(self, scale):
        rows = [
            _core("c-1", "SCSR2213", credits=3),
            _core("c-2", "ULRS1182", credits=2),
        ]
        res = compute_progress(rows, [], scale, template_total_credits=5)
        assert not any("Template rows total" in w for w in res["warnings"])

