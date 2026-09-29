import pytest
from backend.app.engine.parsers.csv_course_parser import CSVCourseParser


def test_repeated_slot_codes_accepted_as_slots():
    """
    Test requirement: repeated SXXXXXX3 rows accepted as 3 distinct slots
    numbered automatically (slot_no 1, 2, 3), without duplicate code errors.
    """
    csv_text = (
        "course_code,course_name,credits,category,prerequisites\n"
        "SXXXXXX3,Free Elective 1,3,Elective,None\n"
        "SXXXXXX3,Free Elective 2,3,Elective,None\n"
        "SXXXXXX3,Free Elective 3,3,Elective,None\n"
    )
    courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    assert errors == []
    assert len(courses) == 3

    assert courses[0]["code"] == "SXXXXXX3"
    assert courses[0]["is_elective_slot"] is True
    assert courses[0]["slot_no"] == 1
    assert courses[0]["match_patterns"] == ["SXXXXXX3"]

    assert courses[1]["code"] == "SXXXXXX3"
    assert courses[1]["is_elective_slot"] is True
    assert courses[1]["slot_no"] == 2
    assert courses[1]["match_patterns"] == ["SXXXXXX3"]

    assert courses[2]["code"] == "SXXXXXX3"
    assert courses[2]["is_elective_slot"] is True
    assert courses[2]["slot_no"] == 3
    assert courses[2]["match_patterns"] == ["SXXXXXX3"]


def test_alternatives_parsed_into_patterns():
    """
    Test requirement: alternatives separated by '/' are parsed into pattern lists.
    Example: SECR5XX3/SECP5XX3/SECJ5XX3 -> ['SECR5XX3', 'SECP5XX3', 'SECJ5XX3']
    """
    csv_text = (
        "course_code,course_name,credits,category,prerequisites\n"
        "SECR5XX3/SECP5XX3/SECJ5XX3,Specialization Elective,3,Elective,None\n"
    )
    courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    assert errors == []
    assert len(courses) == 1

    slot = courses[0]
    assert slot["code"] == "SECR5XX3/SECP5XX3/SECJ5XX3"
    assert slot["is_elective_slot"] is True
    assert slot["slot_no"] == 1
    assert slot["match_patterns"] == ["SECR5XX3", "SECP5XX3", "SECJ5XX3"]
    assert slot["category"] == "Elective"


def test_duplicate_real_course_code_rejected():
    """
    Test requirement: a duplicate real course code is still rejected.
    """
    csv_text = (
        "course_code,course_name,credits,category,prerequisites\n"
        "SECJ1013,Programming Technique I,3,Core,None\n"
        "SECJ1013,Programming Technique I Duplicate,3,Core,None\n"
    )
    courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    assert len(errors) == 1
    assert "Row 3" in errors[0]
    assert "Duplicate course code 'SECJ1013'" in errors[0]


def test_pattern_invalid_character_rejected_with_row_number():
    """
    Test requirement: a pattern with an invalid character is rejected with the row number.
    """
    csv_text = (
        "course_code,course_name,credits,category,prerequisites\n"
        "SECR5$X3/SECP5XX3,Corrupted Elective Slot,3,Elective,None\n"
    )
    courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    assert len(errors) == 1
    assert "Row 2" in errors[0]
    assert "Invalid pattern 'SECR5$X3'" in errors[0]
    assert "alphanumeric" in errors[0].lower()


def test_single_x_parses_as_real_course_not_slot():
    """
    Test requirement: A single X is a normal character.
    'MATX1023' parses as a real course, not an elective slot.
    """
    csv_text = (
        "course_code,course_name,credits,category,prerequisites\n"
        "MATX1023,Engineering Mathematics,3,Core,None\n"
    )
    courses, errors = CSVCourseParser.parse_csv_content(csv_text)

    assert errors == []
    assert len(courses) == 1

    course = courses[0]
    assert course["code"] == "MATX1023"
    assert course["is_elective_slot"] is False
    assert course["slot_no"] is None
    assert course["match_patterns"] is None
    assert course["category"] == "Core"
