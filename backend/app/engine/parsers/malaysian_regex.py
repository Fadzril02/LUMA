"""
Smart Academic Assessment System - Malaysian University Regex Parser
"""

import re
from typing import List, Dict, Any, Tuple, Optional
try:
    from app.schemas.audit import ParsedLineItem
except ImportError:
    from backend.app.schemas.audit import ParsedLineItem


# Grade Regex Pattern: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, E, HL, PC, EX, TD, TS, TL
COURSE_PATTERN = re.compile(
    r'(?P<code>[A-Z]{3,4}\s?[0-9]{4})\s+'               # Code: SECJ1013
    r'(?P<name>[\w\s\(\)\/\-\,\&]+?)\s+'               # Name: PROGRAMMING TECHNIQUE I
    r'(?P<credit>[1-9])\s+'                            # Credits: 3
    r'(?P<grade>[A-D][\+\-]?|[EF]|HL|PC|EX|TD|TS|TL)(?:\s+(?P<gp>[0-4]\.[0-9]{2}))?(?:\s+|$)',
    re.IGNORECASE
)

# Alternative Pattern for tabular transcripts
COURSE_PATTERN_ALT = re.compile(
    r'(?P<code>[A-Z]{3,4}\s?[0-9]{4})\s+'
    r'(?P<name>.+?)\s+'
    r'(?P<credit>[1-9])\s+'
    r'(?P<grade>[A-D][\+\-]?|[EF]|HL|PC|EX|TD|TS|TL)(?:\s+(?P<gp>[0-4]\.[0-9]{2}))?(?:\s+|$)',
    re.IGNORECASE
)

# Matric Number Pattern (e.g., A20EC0123, A24MJ5050, B21CS0012, SX190204)
MATRIC_PATTERN = re.compile(
    r'(?:MATRIC\s*(?:NO|NUMBER)?|NO\.\s*MATRIK)\s*[:.]?\s*([A-Z0-9]{7,12})',
    re.IGNORECASE
)
MATRIC_DIRECT_PATTERN = re.compile(r'\b([A-Z][0-9]{2}[A-Z]{2}[0-9]{4})\b')

# Student Name Pattern
NAME_PATTERN = re.compile(
    r'(?:NAME|NAMA)\s*[:.]?\s*([A-Z\s@\/\.\'\-]+?)(?:\s{2,}|MATRIC|NO|FAKULTI|FACULTY|$)',
    re.IGNORECASE
)

# Semester / Session Pattern
SEMESTER_PATTERN = re.compile(
    r'(?:SEMESTER|SEM)\s*([1-3]|I|II|III|PENDEK|SHORT)\s*(?:SESSION|SESI)?\s*([0-9]{4}\s*[\/\-]\s*[0-9]{4})',
    re.IGNORECASE
)

# Default Malaysian University Grade Point Scale
GRADE_POINTS = {
    "A+": 4.00, "A": 4.00, "A-": 3.67,
    "B+": 3.33, "B": 3.00, "B-": 2.67,
    "C+": 2.33, "C": 2.00, "C-": 1.67,
    "D+": 1.33, "D": 1.00, "E": 0.00,
    "HL": 0.00,  # Lulus (Pass - Neutral)
    "PC": 0.00,  # Pengecualian Kursus (Credit Exemption - Neutral)
    "EX": 0.00,  # Exemption (Neutral)
    "TD": 0.00,  # Tarik Diri (Withdrawn)
    "TS": 0.00,  # Tidak Selesai (Incomplete)
    "TL": 0.00,  # Tidak Lulus (Fail)
}

PASSING_GRADES = {"A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "HL", "PC", "EX"}
NEUTRAL_PASSING_GRADES = {"HL", "PC", "EX"}


class MalaysianTranscriptParser:
    @staticmethod
    def parse_transcript_lines(lines: List[str]) -> Tuple[Dict[str, Any], List[ParsedLineItem], List[str]]:
        """
        Parses list of text lines extracted from a transcript.
        Returns:
            metadata: dict (matric_number, name, etc.)
            parsed_courses: list of ParsedLineItem
            unparsed_lines: list of potential course lines that couldn't be parsed with regex
        """
        metadata: Dict[str, Any] = {
            "matric_number": None,
            "student_name": None,
            "semesters_found": []
        }
        
        parsed_courses: List[ParsedLineItem] = []
        unparsed_lines: List[str] = []
        
        current_semester = "Semester 1 (Default)"
        
        full_text = "\n".join(lines)
        
        # 1. Extract Matric Number
        matric_match = MATRIC_PATTERN.search(full_text)
        if matric_match:
            metadata["matric_number"] = matric_match.group(1).strip()
        else:
            direct_matric = MATRIC_DIRECT_PATTERN.search(full_text)
            if direct_matric:
                metadata["matric_number"] = direct_matric.group(1).strip()

        # 2. Extract Student Name
        name_match = NAME_PATTERN.search(full_text)
        if name_match:
            metadata["student_name"] = name_match.group(1).strip()

        # 3. Line-by-line course extraction with Semester context tracking
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
                
            # Check for semester headers
            sem_match = SEMESTER_PATTERN.search(line_str)
            if sem_match:
                sem_num = sem_match.group(1).strip()
                sesi = sem_match.group(2).replace(" ", "")
                current_semester = f"Sem {sem_num} {sesi}"
                if current_semester not in metadata["semesters_found"]:
                    metadata["semesters_found"].append(current_semester)
                continue

            # Check for Course pattern
            course_match = COURSE_PATTERN.search(line_str) or COURSE_PATTERN_ALT.search(line_str)
            if course_match:
                raw_code = course_match.group("code").replace(" ", "").upper()
                name = course_match.group("name").strip().title()
                credits = int(course_match.group("credit"))
                grade = course_match.group("grade").upper()
                
                # Determine status
                if grade in PASSING_GRADES:
                    status = "Exempted" if grade == "HL" else "Passed"
                elif grade in {"TD", "TS"}:
                    status = "In-Progress"
                else:
                    status = "Failed"
                    
                gp = GRADE_POINTS.get(grade, 0.00)
                
                parsed_courses.append(ParsedLineItem(
                    course_code=raw_code,
                    course_name=name,
                    credits=credits,
                    grade=grade,
                    grade_point=gp,
                    semester=current_semester,
                    status=status,
                    is_ai_parsed=False,
                    raw_extracted_text=line_str
                ))
            else:
                # Flag lines that look like courses (contain 3-4 letters followed by digits) but failed full regex
                if re.search(r'\b[A-Z]{3,4}\s?[0-9]{4}\b', line_str):
                    unparsed_lines.append(line_str)

        return metadata, parsed_courses, unparsed_lines
