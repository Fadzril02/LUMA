"""
Unit Tests for Smart Academic Assessment System Zero-Waste Engine
"""

import pytest
try:
    from app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
    from app.engine.graph_resolver import PrerequisiteGraphResolver
    from app.schemas.audit import ParsedLineItem
    from app.engine.grading import GradingScale, GradeDefinition
except ImportError:
    from backend.app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
    from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
    from backend.app.schemas.audit import ParsedLineItem
    from backend.app.engine.grading import GradingScale, GradeDefinition


@pytest.fixture
def fixture_scale():
    return GradingScale("TEST_INSTITUTION", [
        GradeDefinition("A+", 4.00, 1, True, True, True, 90, 100, "Excellent Pass"),
        GradeDefinition("A", 4.00, 2, True, True, True, 80, 89, "Excellent Pass"),
        GradeDefinition("A-", 3.67, 3, True, True, True, 75, 79, "Excellent Pass"),
        GradeDefinition("B+", 3.33, 4, True, True, True, 70, 74, "Good Pass"),
        GradeDefinition("B", 3.00, 5, True, True, True, 65, 69, "Good Pass"),
        GradeDefinition("B-", 2.67, 6, True, True, True, 60, 64, "Good Pass"),
        GradeDefinition("C+", 2.33, 7, True, True, True, 55, 59, "Pass"),
        GradeDefinition("C", 2.00, 8, True, True, True, 50, 54, "Pass"),
        GradeDefinition("C-", 1.67, 9, True, True, True, 45, 49, "Pass"),
        GradeDefinition("D+", 1.33, 10, True, True, True, 40, 44, "Minimum Pass"),
        GradeDefinition("D", 1.00, 11, False, True, False, 35, 39, "Fail"),
        GradeDefinition("D-", 0.67, 12, False, True, False, 30, 34, "Fail"),
        GradeDefinition("E", 0.00, 13, False, True, False, 0, 29, "Fail"),
        GradeDefinition("F", 0.00, 14, False, True, False, 0, 29, "Fail"),
        GradeDefinition("HL", None, None, True, False, True, None, None, "Pass (non-graded)"),
        GradeDefinition("PC", None, None, True, False, True, None, None, "Pass (non-graded)"),
        GradeDefinition("P", None, None, True, False, True, None, None, "Pass (non-graded)"),
        GradeDefinition("LUS", None, None, True, False, True, None, None, "Pass (non-graded)"),
        GradeDefinition("EX", None, None, True, False, True, None, None, "Exempted"),
        GradeDefinition("CT", None, None, True, False, True, None, None, "Credit Transfer"),
        GradeDefinition("TD", None, None, False, False, False, None, None, "Withdrawn"),
        GradeDefinition("TS", None, None, False, False, False, None, None, "Incomplete"),
    ])


def test_malaysian_regex_parser(fixture_scale):
    sample_transcript_lines = [
        "UNIVERSITI TEKNOLOGI MALAYSIA",
        "ACADEMIC TRANSCRIPT",
        "NAME: AHMAD FAZDIL BIN MOHAMAD    MATRIC NO: A24MJ5050",
        "FACULTY OF ARTIFICIAL INTELLIGENCE",
        "SEMESTER 1 SESSION 2023/2024",
        "SECJ1013 PROGRAMMING TECHNIQUE I 3 A+ 4.00",
        "SECP1513 DISCRETE STRUCTURE 3 A 4.00",
        "SECR1013 DIGITAL LOGIC 3 B+ 3.33",
        "UHMS1182 APPRECIATION OF ETHICS AND CIVILISATIONS 2 A- 3.67",
        "SEMESTER 2 SESSION 2023/2024",
        "SECJ1023 PROGRAMMING TECHNIQUE II 3 A 4.00",
        "SECD2523 DATABASE 3 B 3.00",
        "SECR2043 OPERATING SYSTEMS 3 E 0.00"
    ]

    metadata, parsed_courses, unparsed_lines = MalaysianTranscriptParser.parse_transcript_lines(sample_transcript_lines, scale=fixture_scale)

    assert metadata["matric_number"] == "A24MJ5050"
    assert "AHMAD FAZDIL" in metadata["student_name"]
    assert len(parsed_courses) == 7
    assert unparsed_lines == []

    # Check first course
    c1 = parsed_courses[0]
    assert c1.course_code == "SECJ1013"
    assert c1.credits == 3
    assert c1.grade == "A+"
    assert c1.status == "Passed"

    # Check failed course
    failed_c = [c for c in parsed_courses if c.course_code == "SECR2043"][0]
    assert failed_c.status == "Failed"
    assert failed_c.grade == "E"


def test_prerequisite_graph_resolver(fixture_scale):
    # Mock course catalog with prerequisite requirements
    catalog = {
        "SECJ1013": {"prerequisites": {"type": "AND", "courses": []}},
        "SECJ1023": {"prerequisites": {"type": "AND", "courses": ["SECJ1013"]}},
        "SECJ2013": {"prerequisites": {"type": "AND", "courses": ["SECJ1023"]}},
        "SECJ2154": {"prerequisites": {"type": "AND", "courses": ["SECJ1023"]}},
        "SECJ3032": {"prerequisites": {"type": "AND", "courses": ["SECJ2013"], "min_credits": 80}}
    }

    # Scenario: Student passed SECJ1013 and SECJ1023, but took SECJ3032 prematurely without credits
    records = [
        ParsedLineItem(course_code="SECJ1013", course_name="Prog I", credits=3, grade="A", grade_point=4.0, semester="Sem 1", status="Passed"),
        ParsedLineItem(course_code="SECJ1023", course_name="Prog II", credits=3, grade="B", grade_point=3.0, semester="Sem 2", status="Passed"),
        ParsedLineItem(course_code="SECJ2013", course_name="Data Structures", credits=3, grade="A", grade_point=4.0, semester="Sem 3", status="Passed"),
        ParsedLineItem(course_code="SECJ3032", course_name="FYP 1", credits=2, grade="A", grade_point=4.0, semester="Sem 4", status="Passed"),
    ]

    results, summary = PrerequisiteGraphResolver.audit_student_records(records, catalog, scale=fixture_scale)

    # SECJ1023 prerequisite SECJ1013 was met
    secj1023_res = [r for r in results if r.course_code == "SECJ1023"][0]
    assert secj1023_res.prerequisite_met is True
    assert secj1023_res.traffic_light == "GREEN"

    # SECJ3032 required 80 credits, but student only has 11 credits earned -> Missing Prereq -> RED
    fyp_res = [r for r in results if r.course_code == "SECJ3032"][0]
    assert fyp_res.prerequisite_met is False
    assert fyp_res.traffic_light == "RED"
    assert "Requires 80 Credits Earned" in fyp_res.missing_prerequisites

    assert summary.overall_traffic_light == "RED"
    assert summary.unmet_prerequisites_count == 1
    assert summary.cgpa > 3.0


def test_min_grade_prerequisite_enforcement(fixture_scale):
    """
    Verifies that a student passing a prerequisite with a grade below min_grade
    (e.g., 'D' when 'C' is required) fails the prerequisite check.
    """
    catalog = {
        "SECJ1013": {"prerequisites": {"type": "AND", "courses": []}},
        "SECJ1023": {"prerequisites": {"type": "AND", "courses": ["SECJ1013"], "min_grade": "C"}},
        "SECJ2013": {"prerequisites": {"type": "AND", "courses": ["SECJ1023"], "min_grade": "B"}}
    }

    # Case 1: Student passed SECJ1013 with 'D' (GP: 1.00) -> Below required 'C' (GP: 2.00)
    records_sub_grade = [
        ParsedLineItem(course_code="SECJ1013", course_name="Prog I", credits=3, grade="D", grade_point=1.00, semester="Sem 1", status="Passed"),
        ParsedLineItem(course_code="SECJ1023", course_name="Prog II", credits=3, grade="B", grade_point=3.00, semester="Sem 2", status="Passed"),
    ]
    results1, summary1 = PrerequisiteGraphResolver.audit_student_records(records_sub_grade, catalog, scale=fixture_scale)
    secj1023_fail = [r for r in results1 if r.course_code == "SECJ1023"][0]
    assert secj1023_fail.prerequisite_met is False
    assert secj1023_fail.traffic_light == "RED"
    assert any("Required min grade C" in m for m in secj1023_fail.missing_prerequisites)

    # Case 2: Student passed SECJ1013 with 'C' (GP: 2.00) -> Meets min_grade 'C'
    records_met_grade = [
        ParsedLineItem(course_code="SECJ1013", course_name="Prog I", credits=3, grade="C", grade_point=2.00, semester="Sem 1", status="Passed"),
        ParsedLineItem(course_code="SECJ1023", course_name="Prog II", credits=3, grade="B", grade_point=3.00, semester="Sem 2", status="Passed"),
    ]
    results2, summary2 = PrerequisiteGraphResolver.audit_student_records(records_met_grade, catalog, scale=fixture_scale)
    secj1023_ok = [r for r in results2 if r.course_code == "SECJ1023"][0]
    assert secj1023_ok.prerequisite_met is True
    assert secj1023_ok.traffic_light == "GREEN"

    # Case 3: Credit Exemption 'HL' (Neutral grade) always satisfies prerequisite regardless of min_grade
    records_exemption = [
        ParsedLineItem(course_code="SECJ1013", course_name="Prog I", credits=3, grade="HL", grade_point=0.00, semester="Sem 1", status="Exempted"),
        ParsedLineItem(course_code="SECJ1023", course_name="Prog II", credits=3, grade="B", grade_point=3.00, semester="Sem 2", status="Passed"),
    ]
    results3, summary3 = PrerequisiteGraphResolver.audit_student_records(records_exemption, catalog, scale=fixture_scale)
    secj1023_ex = [r for r in results3 if r.course_code == "SECJ1023"][0]
    assert secj1023_ex.prerequisite_met is True
    assert secj1023_ex.traffic_light == "GREEN"


def test_or_prerequisite_and_exemption(fixture_scale):
    catalog = {
        "SECV2223": {"prerequisites": {"type": "OR", "courses": ["SECJ1013", "SECD2523"]}}
    }
    records = [
        ParsedLineItem(course_code="SECD2523", course_name="Database", credits=3, grade="HL", grade_point=0.0, semester="Sem 1", status="Exempted"),
        ParsedLineItem(course_code="SECV2223", course_name="Web Prog", credits=3, grade="A", grade_point=4.0, semester="Sem 2", status="Passed")
    ]
    results, summary = PrerequisiteGraphResolver.audit_student_records(records, catalog, scale=fixture_scale)
    web_res = [r for r in results if r.course_code == "SECV2223"][0]
    assert web_res.prerequisite_met is True
    assert web_res.traffic_light == "GREEN"
    assert summary.overall_traffic_light == "GREEN"


def test_csv_course_parser():
    try:
        from app.engine.parsers.csv_course_parser import CSVCourseParser
    except ImportError:
        from backend.app.engine.parsers.csv_course_parser import CSVCourseParser
    
    sample_csv = """course_code,course_name,credits,category,prerequisites
SECJ1013,Programming Technique I,3,Core,None
SECJ1023,Programming Technique II,3,Core,SECJ1013
SECV2223,Web Programming,3,Core,SECJ1013 OR SECD2523
SECJ3032,Final Year Project 1,2,Core,SECJ2203 AND SECJ2013 min_credits: 80
"""
    courses, errors = CSVCourseParser.parse_csv_content(sample_csv)
    assert len(courses) == 4
    assert errors == []

    # Check SECJ1023
    c2 = [c for c in courses if c["code"] == "SECJ1023"][0]
    assert c2["prerequisites"]["courses"] == ["SECJ1013"]
    assert c2["prerequisites"]["type"] == "AND"

    # Check SECV2223 (OR prereq)
    c3 = [c for c in courses if c["code"] == "SECV2223"][0]
    assert c3["prerequisites"]["type"] == "OR"
    assert "SECJ1013" in c3["prerequisites"]["courses"]
    assert "SECD2523" in c3["prerequisites"]["courses"]

    # Check SECJ3032 (Credit gate)
    c4 = [c for c in courses if c["code"] == "SECJ3032"][0]
    assert c4["prerequisites"]["min_credits"] == 80
    assert "SECJ2203" in c4["prerequisites"]["courses"]


def test_international_course_codes_and_semesters(fixture_scale):
    try:
        from app.engine.parsers.malaysian_regex import MalaysianTranscriptParser, COURSE_PATTERN, SEMESTER_PATTERN
        from app.engine.parsers.csv_course_parser import CSVCourseParser
    except ImportError:
        from backend.app.engine.parsers.malaysian_regex import MalaysianTranscriptParser, COURSE_PATTERN, SEMESTER_PATTERN
        from backend.app.engine.parsers.csv_course_parser import CSVCourseParser

    # Test international course codes matching (2-6 letters, optional hyphens/spaces, 3-5 digits, optional trailing letter)
    test_lines = [
        "FALL TERM 2024",
        "CS-101 Introduction to Computing 3 A 4.00",
        "ENG101A Academic Writing 3 B+ 3.33",
        "SPRING TERM 2025",
        "COMP30001 Advanced Algorithms 4 A- 3.67",
        "SEMESTER 1 2024/2025",
        "SECJ1013 Programming Technique I 3 A 4.00"
    ]
    meta, parsed, unparsed = MalaysianTranscriptParser.parse_transcript_lines(test_lines, scale=fixture_scale)
    parsed_codes = [p.course_code for p in parsed]
    assert "CS-101" in parsed_codes or "CS101" in parsed_codes
    assert "ENG101A" in parsed_codes
    assert "COMP30001" in parsed_codes
    assert "SECJ1013" in parsed_codes
    assert len(parsed) == 4

    # Test international semester pattern
    assert SEMESTER_PATTERN.search("FALL TERM 2024") is not None
    assert SEMESTER_PATTERN.search("SPRING SEM 2025") is not None
    assert SEMESTER_PATTERN.search("TERM 2 2024/2025") is not None
    assert SEMESTER_PATTERN.search("TRIMESTER 1 2023/2024") is not None
    assert SEMESTER_PATTERN.search("QUARTER 3 2024") is not None

    # Test CSV parser with relaxed codes
    prereqs = CSVCourseParser.parse_prerequisite_string("CS-101 AND ENG101A OR COMP30001")
    assert "CS-101" in prereqs["courses"] or "CS101" in prereqs["courses"]
    assert "ENG101A" in prereqs["courses"]
    assert "COMP30001" in prereqs["courses"]


def test_dynamic_credits_in_graph_resolver(fixture_scale):
    try:
        from app.engine.graph_resolver import PrerequisiteGraphResolver
        from app.schemas.audit import ParsedLineItem
    except ImportError:
        from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
        from backend.app.schemas.audit import ParsedLineItem

    catalog = {}
    records = [
        ParsedLineItem(course_code="CS101", course_name="Intro", credits=3, grade="A", grade_point=4.0, semester="Fall 2024", status="Passed")
    ]
    # Test explicit dynamic credits passed (e.g. 128 instead of hardcoded 130)
    results, summary = PrerequisiteGraphResolver.audit_student_records(records, catalog, scale=fixture_scale, total_required_credits=128)
    assert summary.total_credits_required == 128
    assert summary.total_credits_earned == 3


def test_hadir_lulus_and_neutral_passing_grades(fixture_scale):
    """
    Verifies that 'HL', 'PC', 'EX', 'P', 'LUS' are all treated as passing/satisfied,
    never treated as failed, and satisfy prerequisites without requiring grade_point >= 2.0.
    """
    try:
        from app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
        from app.engine.graph_resolver import PrerequisiteGraphResolver
        from app.schemas.audit import ParsedLineItem
    except ImportError:
        from backend.app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
        from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
        from backend.app.schemas.audit import ParsedLineItem

    # 1. Verify scale definitions for neutral passing grades
    for grade in ["HL", "PC", "EX", "P", "LUS"]:
        assert fixture_scale.is_pass(grade) is True
        assert fixture_scale.counts_in_cgpa(grade) is False
        assert fixture_scale.counts_as_completed(grade) is True

    # 2. Parse transcript lines with HL, PC, EX, P, LUS
    lines = [
        "SEMESTER 1 SESSION 2024/2025",
        "SECJ1013 PROGRAMMING TECHNIQUE I 3 HL 0.00",
        "SECP1513 DISCRETE STRUCTURE 3 PC 0.00",
        "UHMS1182 ETHICS 2 EX 0.00",
        "UKQT3001 CO-CURRICULUM 1 P 0.00",
        "ULAB1122 ENGLISH 2 LUS 0.00"
    ]
    _, courses, unparsed = MalaysianTranscriptParser.parse_transcript_lines(lines, scale=fixture_scale)
    assert len(courses) == 5
    for c in courses:
        assert c.status in ["Passed", "Exempted"]
        assert c.status != "Failed"

    # 3. Test that HL satisfies prerequisite with min_grade='C' (GP 2.00) even with GP=0.0
    catalog = {
        "SECJ1013": {"prerequisites": {"type": "AND", "courses": []}},
        "SECJ1023": {"prerequisites": {"type": "AND", "courses": ["SECJ1013"], "min_grade": "C"}}
    }
    records = [
        ParsedLineItem(course_code="SECJ1013", course_name="Prog I", credits=3, grade="HL", grade_point=0.00, semester="Sem 1", status="Exempted"),
        ParsedLineItem(course_code="SECJ1023", course_name="Prog II", credits=3, grade="A", grade_point=4.00, semester="Sem 2", status="Passed")
    ]
    results, summary = PrerequisiteGraphResolver.audit_student_records(records, catalog, scale=fixture_scale)
    secj1023 = [r for r in results if r.course_code == "SECJ1023"][0]
    assert secj1023.prerequisite_met is True
    assert secj1023.traffic_light == "GREEN"
    assert summary.total_credits_earned == 6
