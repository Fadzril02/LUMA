"""
Unit Tests for Smart Academic Assessment System Zero-Waste Engine
"""

import unittest
try:
    from app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
    from app.engine.graph_resolver import PrerequisiteGraphResolver
    from app.schemas.audit import ParsedLineItem
except ImportError:
    from backend.app.engine.parsers.malaysian_regex import MalaysianTranscriptParser
    from backend.app.engine.graph_resolver import PrerequisiteGraphResolver
    from backend.app.schemas.audit import ParsedLineItem


def test_malaysian_regex_parser():
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

    metadata, parsed_courses, unparsed_lines = MalaysianTranscriptParser.parse_transcript_lines(sample_transcript_lines)

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


def test_prerequisite_graph_resolver():
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

    results, summary = PrerequisiteGraphResolver.audit_student_records(records, catalog)

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


def test_or_prerequisite_and_exemption():
    catalog = {
        "SECV2223": {"prerequisites": {"type": "OR", "courses": ["SECJ1013", "SECD2523"]}}
    }
    records = [
        ParsedLineItem(course_code="SECD2523", course_name="Database", credits=3, grade="HL", grade_point=0.0, semester="Sem 1", status="Exempted"),
        ParsedLineItem(course_code="SECV2223", course_name="Web Prog", credits=3, grade="A", grade_point=4.0, semester="Sem 2", status="Passed")
    ]
    results, summary = PrerequisiteGraphResolver.audit_student_records(records, catalog)
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
