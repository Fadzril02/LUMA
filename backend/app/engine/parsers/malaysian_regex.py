"""
Smart Academic Assessment System - Malaysian University Regex Parser
"""

import re
from typing import List, Dict, Any, Tuple, Optional

try:
    from app.schemas.audit import ParsedLineItem
    from app.engine.grading import GradingScale, normalize_semester
except ImportError:
    from backend.app.schemas.audit import ParsedLineItem
    from backend.app.engine.grading import GradingScale, normalize_semester


# Course Regex Pattern (single-line: allows 2 to 6 letters, optional spaces/hyphens, 3 to 5 digits, optional trailing letter)
# Supports optional grade point and optional printed status column (e.g. LULUS, GAGAL, PASS, FAIL, EXEMPT)
COURSE_PATTERN = re.compile(
    r'(?P<code>[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?)\s+'
    r'(?P<name>[\w\s\(\)\/\-\,\&]+?)\s+'
    r'(?P<credit>[1-9])\s+'
    r'(?P<grade>[A-D][\+\-]?|[EF]|HL|PC|EX|CT|P|LUS|TD|TS|TL)'
    r'(?:\s+(?P<gp>[0-4]\.[0-9]{2}))?'
    r'(?:\s+(?P<printed_status>PASS(?:ED)?|FAIL(?:ED)?|LULUS|GAGAL|EXEMPT(?:ED)?|PENGECUALIAN))?'
    r'(?:\s+|$)',
    re.IGNORECASE
)

# Alternative Pattern for tabular single-line transcripts
COURSE_PATTERN_ALT = re.compile(
    r'(?P<code>[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?)\s+'
    r'(?P<name>.+?)\s+'
    r'(?P<credit>[1-9])\s+'
    r'(?P<grade>[A-D][\+\-]?|[EF]|HL|PC|EX|CT|P|LUS|TD|TS|TL)'
    r'(?:\s+(?P<gp>[0-4]\.[0-9]{2}))?'
    r'(?:\s+(?P<printed_status>PASS(?:ED)?|FAIL(?:ED)?|LULUS|GAGAL|EXEMPT(?:ED)?|PENGECUALIAN))?'
    r'(?:\s+|$)',
    re.IGNORECASE
)

# Individual Token Patterns for Multi-Line / Tabular Block Parsing
CODE_TOKEN_PATTERN = re.compile(r'^[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?$', re.IGNORECASE)
GRADE_TOKEN_PATTERN = re.compile(r'^(?:A\+|A|A\-|B\+|B|B\-|C\+|C|C\-|D\+|D|D\-|E|F|HL|PC|EX|CT|P|LUS|TD|TS|TL)$', re.IGNORECASE)
CREDIT_TOKEN_PATTERN = re.compile(r'^[1-9]$')
GP_TOKEN_PATTERN = re.compile(r'^[0-4]\.[0-9]{2}$')
STATUS_TOKEN_PATTERN = re.compile(r'^(?:PASS|PASSED|FAIL|FAILED|LULUS|GAGAL|EXEMPT|EXEMPTED|PENGECUALIAN)$', re.IGNORECASE)

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


class MalaysianTranscriptParser:
    @staticmethod
    def parse_transcript_lines(
        lines: List[str],
        scale: GradingScale
    ) -> Tuple[Dict[str, Any], List[ParsedLineItem], List[str]]:
        """
        Parses list of text lines extracted from a transcript.
        Normalizes non-breaking spaces and supports both single-line and tabular/multi-line block layouts.
        Performs status cross-check if printed status is present, attaching a warning on disagreement.
        Requires an explicit GradingScale instance.
        """
        if scale is None:
            raise ValueError("scale (GradingScale) is a required parameter for parse_transcript_lines.")

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
        
        full_text = "\n".join(cleaned_lines)

        # 2. Extract Matric Number
        matric_match = MATRIC_PATTERN.search(full_text)
        if matric_match:
            metadata["matric_number"] = matric_match.group(1).upper()
        else:
            direct_matric = MATRIC_DIRECT_PATTERN.search(full_text)
            if direct_matric:
                metadata["matric_number"] = direct_matric.group(1).upper()

        # 3. Extract Student Name
        name_match = NAME_PATTERN.search(full_text)
        if name_match:
            raw_name = name_match.group(1).strip()
            # Clean common trailing artifacts
            clean_name = re.sub(r'\s+', ' ', raw_name)
            metadata["student_name"] = clean_name.strip()

        # 4. Extract Global/Header Semesters
        current_semester = "SEM 1 2024/2025"
        for i, line in enumerate(cleaned_lines):
            sem_m = SEMESTER_SPLIT_SEM.search(line)
            if sem_m and i + 1 < len(cleaned_lines):
                ses_m = SEMESTER_SPLIT_SES.search(cleaned_lines[i + 1])
                if ses_m:
                    norm = normalize_semester(f"Sem {sem_m.group(1).strip()} {ses_m.group(1).replace(' ', '')}")
                    current_semester = norm
                    if norm not in metadata["semesters_found"]:
                        metadata["semesters_found"].append(norm)
            elif sem_m and not (i + 1 < len(cleaned_lines) and SEMESTER_SPLIT_SES.search(cleaned_lines[i + 1])):
                inline_m = SEMESTER_PATTERN.search(line)
                if inline_m:
                    try:
                        norm = normalize_semester(inline_m.group(0))
                        current_semester = norm
                    except ValueError:
                        current_semester = inline_m.group(0).strip()
                    if current_semester not in metadata["semesters_found"]:
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
                try:
                    norm = normalize_semester(sem_inline.group(0))
                    current_semester = norm
                except ValueError:
                    current_semester = sem_inline.group(0).strip()
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
                printed_status = single_match.groupdict().get("printed_status")

                gp = scale.grade_points(grade, raw_code)
                is_p = scale.is_pass(grade, raw_code)
                in_cgpa = scale.counts_in_cgpa(grade, raw_code)
                as_comp = scale.counts_as_completed(grade, raw_code)

                if is_p and not in_cgpa and as_comp:
                    status = "Exempted"
                elif is_p:
                    status = "Passed"
                elif grade in {"TD", "TS"}:
                    status = "In-Progress"
                else:
                    status = "Failed"

                # Status cross-check: Never auto-correct, attach warning on disagreement
                warning: Optional[str] = None
                if printed_status:
                    p_clean = printed_status.upper()
                    printed_is_pass = p_clean in {"PASS", "PASSED", "LULUS", "EXEMPT", "EXEMPTED", "PENGECUALIAN"}
                    printed_is_fail = p_clean in {"FAIL", "FAILED", "GAGAL"}

                    if printed_is_pass and not is_p:
                        warning = f"Discrepancy: Printed transcript status '{printed_status}' indicates PASS, but tenant grading scale defines grade '{grade}' as FAIL. Requires advisor verification."
                    elif printed_is_fail and is_p:
                        warning = f"Discrepancy: Printed transcript status '{printed_status}' indicates FAIL, but tenant grading scale defines grade '{grade}' as PASS. Requires advisor verification."

                parsed_courses.append(ParsedLineItem(
                    course_code=raw_code,
                    course_name=name,
                    credits=credits,
                    grade=grade,
                    grade_point=gp,
                    semester=current_semester,
                    status=status,
                    warning=warning,
                    is_ai_parsed=False,
                    raw_extracted_text=line_str
                ))
                i += 1
                continue

            # Path B: Multi-Line / Tabular Block Parsing
            is_code_candidate = CODE_TOKEN_PATTERN.match(line_str) and line_str.upper() not in stop_keywords
            if is_code_candidate:
                code_val = line_str.replace(" ", "").upper()
                block_title: Optional[str] = None
                block_grade: Optional[str] = None
                block_credits: Optional[int] = None
                block_gp: Optional[float] = None
                block_printed_status: Optional[str] = None
                consumed_lines: List[str] = [line_str]

                j = i + 1
                # Scan ahead up to 7 lines for title, grade, credits, grade points, printed status
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
                    # Check for Printed Status token (e.g. 'LULUS', 'GAGAL', 'PASS', 'FAIL')
                    elif not block_printed_status and STATUS_TOKEN_PATTERN.match(candidate_line):
                        block_printed_status = candidate_line.strip()
                    # Check for Course Title line (text longer than 2 characters, not purely numbers)
                    elif not block_title and len(candidate_line) > 2 and not re.match(r'^[0-9\.]+$', candidate_line):
                        block_title = candidate_line.strip().title()

                    j += 1

                # If we successfully captured at least code and grade, record the parsed course
                if block_grade:
                    final_credits = block_credits or 3
                    final_gp = block_gp if block_gp is not None else scale.grade_points(block_grade, code_val)
                    is_p = scale.is_pass(block_grade, code_val)
                    in_cgpa = scale.counts_in_cgpa(block_grade, code_val)
                    as_comp = scale.counts_as_completed(block_grade, code_val)

                    if is_p and not in_cgpa and as_comp:
                        status = "Exempted"
                    elif is_p:
                        status = "Passed"
                    elif block_grade in {"TD", "TS"}:
                        status = "In-Progress"
                    else:
                        status = "Failed"

                    # Status cross-check
                    warning = None
                    if block_printed_status:
                        p_clean = block_printed_status.upper()
                        printed_is_pass = p_clean in {"PASS", "PASSED", "LULUS", "EXEMPT", "EXEMPTED", "PENGECUALIAN"}
                        printed_is_fail = p_clean in {"FAIL", "FAILED", "GAGAL"}

                        if printed_is_pass and not is_p:
                            warning = f"Discrepancy: Printed transcript status '{block_printed_status}' indicates PASS, but tenant grading scale defines grade '{block_grade}' as FAIL. Requires advisor verification."
                        elif printed_is_fail and is_p:
                            warning = f"Discrepancy: Printed transcript status '{block_printed_status}' indicates FAIL, but tenant grading scale defines grade '{block_grade}' as PASS. Requires advisor verification."

                    parsed_courses.append(ParsedLineItem(
                        course_code=code_val,
                        course_name=block_title or code_val,
                        credits=final_credits,
                        grade=block_grade,
                        grade_point=final_gp,
                        semester=current_semester,
                        status=status,
                        warning=warning,
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
