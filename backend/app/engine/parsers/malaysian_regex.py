"""
Smart Academic Assessment System - Malaysian University Regex Parser
"""

import re
from typing import List, Dict, Any, Tuple, Optional
try:
    from app.schemas.audit import ParsedLineItem
except ImportError:
    from backend.app.schemas.audit import ParsedLineItem


# Course Regex Pattern (single-line: allows 2 to 6 letters, optional spaces/hyphens, 3 to 5 digits, optional trailing letter)
COURSE_PATTERN = re.compile(
    r'(?P<code>[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?)\s+'
    r'(?P<name>[\w\s\(\)\/\-\,\&]+?)\s+'
    r'(?P<credit>[1-9])\s+'
    r'(?P<grade>[A-D][\+\-]?|[EF]|HL|PC|EX|TD|TS|TL)(?:\s+(?P<gp>[0-4]\.[0-9]{2}))?(?:\s+|$)',
    re.IGNORECASE
)

# Alternative Pattern for tabular single-line transcripts
COURSE_PATTERN_ALT = re.compile(
    r'(?P<code>[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?)\s+'
    r'(?P<name>.+?)\s+'
    r'(?P<credit>[1-9])\s+'
    r'(?P<grade>[A-D][\+\-]?|[EF]|HL|PC|EX|TD|TS|TL)(?:\s+(?P<gp>[0-4]\.[0-9]{2}))?(?:\s+|$)',
    re.IGNORECASE
)

# Individual Token Patterns for Multi-Line / Tabular Block Parsing
CODE_TOKEN_PATTERN = re.compile(r'^[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?$', re.IGNORECASE)
GRADE_TOKEN_PATTERN = re.compile(r'^(?:A\+|A|A\-|B\+|B|B\-|C\+|C|C\-|D\+|D|E|HL|PC|EX|TD|TS|TL)$', re.IGNORECASE)
CREDIT_TOKEN_PATTERN = re.compile(r'^[1-9]$')
GP_TOKEN_PATTERN = re.compile(r'^[0-4]\.[0-9]{2}$')

# Matric Number Pattern (e.g., A20EC0123, A24MJ5050, B21CS0012, SX190204)
MATRIC_PATTERN = re.compile(
    r'(?:MATRIC\s*(?:NO|NUMBER)?|NO\.\s*MATRIK)\s*[:.]?\s*\n?\s*(?::\s*\n?\s*)?([A-Z0-9]{7,12})',
    re.IGNORECASE
)
MATRIC_DIRECT_PATTERN = re.compile(r'\b([A-Z][0-9]{2}[A-Z]{2}[0-9]{4})\b')

# Student Name Pattern - strictly terminates on newline or label keywords
NAME_PATTERN = re.compile(
    r'(?:NAME|NAMA)\s*[:.]?\s*\n?\s*(?::\s*\n?\s*)?([A-Z\s@\/\.\'\-]+?)(?:\r?\n|EXAMINATION|MATRIC|NO\.|FAKULTI|FACULTY|IC\/ISID|$)',
    re.IGNORECASE
)

# Semester / Session Pattern (supports single-line and multi-line formats)
SEMESTER_PATTERN = re.compile(
    r'(?:SEMESTER|SEM|TERM|TRIMESTER|QUARTER|FALL|SPRING|SUMMER)\s*[:.]?\s*([A-Za-z0-9]+)\s*(?:SESSION|SESI|YEAR)?\s*([0-9]{4}(?:\s*[\/\-]\s*[0-9]{4})?)',
    re.IGNORECASE
)
SEMESTER_SPLIT_SEM = re.compile(r'(?:SEMESTER|SEM)\s*[:.]?\s*([0-9]+)', re.IGNORECASE)
SEMESTER_SPLIT_SES = re.compile(r'(?:SESSION|SESI)\s*[:.]?\s*([0-9]{4}\s*[\/\-]\s*[0-9]{4})', re.IGNORECASE)

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
        Normalizes non-breaking spaces and supports both single-line and tabular/multi-line block layouts.
        """
        # 1. Normalize non-breaking spaces (\xa0 -> ' ') and clean whitespace
        cleaned_lines: List[str] = []
        for line in lines:
            c = line.replace('\xa0', ' ').strip()
            if c:
                cleaned_lines.append(c)

        metadata: Dict[str, Any] = {
            "matric_number": None,
            "student_name": None,
            "semesters_found": []
        }
        
        parsed_courses: List[ParsedLineItem] = []
        unparsed_lines: List[str] = []
        
        current_semester = "Semester 1 (Default)"
        full_text = "\n".join(cleaned_lines)
        
        # 2. Extract Matric Number
        matric_match = MATRIC_PATTERN.search(full_text)
        if matric_match:
            metadata["matric_number"] = matric_match.group(1).strip()
        else:
            direct_matric = MATRIC_DIRECT_PATTERN.search(full_text)
            if direct_matric:
                metadata["matric_number"] = direct_matric.group(1).strip()

        # 3. Extract Student Name (strict newline/keyword termination)
        name_match = NAME_PATTERN.search(full_text)
        if name_match:
            extracted_name = name_match.group(1).splitlines()[0].strip()
            metadata["student_name"] = re.sub(r'\s+', ' ', extracted_name)

        # 4. Extract Semester / Session (handles multi-line and single-line)
        sem_single = SEMESTER_PATTERN.search(full_text)
        if sem_single:
            sem_val = sem_single.group(1).strip()
            ses_val = sem_single.group(2).replace(" ", "")
            current_semester = f"Sem {sem_val} {ses_val}"
            metadata["semesters_found"].append(current_semester)
        else:
            sem_m = SEMESTER_SPLIT_SEM.search(full_text)
            ses_m = SEMESTER_SPLIT_SES.search(full_text)
            if sem_m and ses_m:
                current_semester = f"Sem {sem_m.group(1).strip()} {ses_m.group(1).replace(' ', '')}"
                metadata["semesters_found"].append(current_semester)

        # 5. Course Extraction Loop (Single-Line + Tabular Multi-Line Block Parsing)
        i = 0
        n = len(cleaned_lines)
        stop_keywords = {"CODE", "COURSE", "TOTAL", "TOTAL CREDITS", "GPA", "CGPA", "This Sem", "All Sem", "GRADING SYSTEM"}

        while i < n:
            line_str = cleaned_lines[i]
            
            # Check for inline semester header updates
            sem_inline = SEMESTER_PATTERN.search(line_str)
            if sem_inline:
                s_num = sem_inline.group(1).strip()
                s_ses = sem_inline.group(2).replace(" ", "")
                current_semester = f"Sem {s_num} {s_ses}"
                if current_semester not in metadata["semesters_found"]:
                    metadata["semesters_found"].append(current_semester)
                i += 1
                continue

            # Path A: Single-Line Regex Match
            single_match = COURSE_PATTERN.search(line_str) or COURSE_PATTERN_ALT.search(line_str)
            if single_match:
                raw_code = single_match.group("code").replace(" ", "").upper()
                name = single_match.group("name").strip().title()
                credits = int(single_match.group("credit"))
                grade = single_match.group("grade").upper()
                gp = GRADE_POINTS.get(grade, 0.00)

                status = "Exempted" if grade == "HL" else ("Passed" if grade in PASSING_GRADES else ("In-Progress" if grade in {"TD", "TS"} else "Failed"))
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
                i += 1
                continue

            # Path B: Multi-Line / Tabular Block Parsing
            # Detect standalone course code on this line (e.g. 'SCSE1013', 'SECJ1023')
            is_code_candidate = CODE_TOKEN_PATTERN.match(line_str) and line_str.upper() not in stop_keywords
            if is_code_candidate:
                code_val = line_str.replace(" ", "").upper()
                block_title: Optional[str] = None
                block_grade: Optional[str] = None
                block_credits: Optional[int] = None
                block_gp: Optional[float] = None
                consumed_lines: List[str] = [line_str]

                j = i + 1
                # Scan ahead up to 7 lines for title, grade, credits, grade points
                while j < min(i + 8, n):
                    candidate_line = cleaned_lines[j]
                    if CODE_TOKEN_PATTERN.match(candidate_line) or any(candidate_line.startswith(kw) for kw in stop_keywords):
                        break

                    consumed_lines.append(candidate_line)

                    # Check for Grade token (e.g. 'A', 'B+', 'HL')
                    if not block_grade and GRADE_TOKEN_PATTERN.match(candidate_line):
                        block_grade = candidate_line.upper()
                    # Check for Grade Point token (e.g. '4.00', '3.33')
                    elif block_gp is None and GP_TOKEN_PATTERN.match(candidate_line):
                        try:
                            block_gp = float(candidate_line)
                        except ValueError:
                            pass
                    # Check for Single-digit Credit Hour token (e.g. '3', '2')
                    elif block_credits is None and CREDIT_TOKEN_PATTERN.match(candidate_line):
                        block_credits = int(candidate_line)
                    # Check for Course Title line (text longer than 2 characters, not purely numbers)
                    elif not block_title and len(candidate_line) > 2 and not re.match(r'^[0-9\.]+$', candidate_line):
                        block_title = candidate_line.strip().title()

                    j += 1

                # If we successfully captured at least code and grade, record the parsed course
                if block_grade:
                    final_credits = block_credits or 3
                    final_gp = block_gp if block_gp is not None else GRADE_POINTS.get(block_grade, 0.00)
                    status = "Exempted" if block_grade == "HL" else ("Passed" if block_grade in PASSING_GRADES else ("In-Progress" if block_grade in {"TD", "TS"} else "Failed"))
                    
                    parsed_courses.append(ParsedLineItem(
                        course_code=code_val,
                        course_name=block_title or code_val,
                        credits=final_credits,
                        grade=block_grade,
                        grade_point=final_gp,
                        semester=current_semester,
                        status=status,
                        is_ai_parsed=False,
                        raw_extracted_text=" | ".join(consumed_lines)
                    ))
                    i = j
                    continue

            # Path C: Unparsed candidate flagging
            if re.search(r'\b[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?\b', line_str) and line_str.upper() not in stop_keywords:
                unparsed_lines.append(line_str)

            i += 1

        return metadata, parsed_courses, unparsed_lines
