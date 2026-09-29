"""
[PROJECT_NAME] CSV Course Catalog Parser
Company: [COMPANY_NAME]
"""

import csv
import io
import re
from typing import List, Dict, Any, Tuple


class CSVCourseParser:
    @staticmethod
    def parse_prerequisite_string(raw_prereqs: str) -> Dict[str, Any]:
        """
        Converts natural language prerequisite strings into structured JSONB.
        Examples:
            "SECJ1013 AND SECJ1023" -> {"type": "AND", "courses": ["SECJ1013", "SECJ1023"], "min_grade": "C", "min_credits": 0}
            "SECJ1013 OR SECD2523" -> {"type": "OR", "courses": ["SECJ1013", "SECD2523"], "min_grade": "C", "min_credits": 0}
            "SECJ2013, min_credits: 80" -> {"type": "AND", "courses": ["SECJ2013"], "min_grade": "C", "min_credits": 80}
            "" or "None" -> {"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}
        """
        if not raw_prereqs or raw_prereqs.strip().lower() in ["none", "nil", "-", "n/a", ""]:
            return {"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0, "has_custom_min_grade": False}

        cleaned = raw_prereqs.strip()
        
        # Check for min credits requirements
        min_credits = 0
        min_cred_match = re.search(r'(?:min_credits|credits?|jam\s*kredit)\s*[:=]?\s*([0-9]+)', cleaned, re.IGNORECASE)
        if min_cred_match:
            min_credits = int(min_cred_match.group(1))

        # Check for min grade if specified in CSV (e.g. min_grade: B or grade: B+)
        min_grade_match = re.search(r'(?:min_grade|grade|gred)\s*[:=]?\s*([A-Za-z][+-]?)', cleaned, re.IGNORECASE)
        has_custom = bool(min_grade_match)
        min_grade = min_grade_match.group(1).upper() if min_grade_match else "C"

        # Check for OR vs AND
        prereq_type = "OR" if " OR " in cleaned.upper() else "AND"

        # Extract course codes (allows 2 to 6 letters, optional spaces/hyphens, 3 to 5 digits, optional trailing letter)
        course_codes = re.findall(r'\b[A-Z]{2,6}\s*[-]?\s*[0-9]{3,5}[A-Z]?\b', cleaned.upper())
        normalized_codes = [c.replace(" ", "") for c in course_codes]

        return {
            "type": prereq_type,
            "courses": list(dict.fromkeys(normalized_codes)),  # preserve order & unique
            "min_grade": min_grade,
            "min_credits": min_credits,
            "has_custom_min_grade": has_custom
        }

    @classmethod
    def parse_csv_content(cls, csv_text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parses CSV string content into course records for database insertion.
        Expected headers: course_code, course_name, credits, prerequisites, [category]
        """
        courses: List[Dict[str, Any]] = []
        errors: List[str] = []

        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        
        # Normalize header names (lowercase, stripped, remove underscores/spaces)
        if not reader.fieldnames:
            return [], ["CSV file is empty or missing headers."]

        headers = {f.strip().lower().replace(" ", "_"): f for f in reader.fieldnames}

        code_key = headers.get("course_code") or headers.get("code") or headers.get("kod_kursus")
        name_key = headers.get("course_name") or headers.get("name") or headers.get("nama_kursus") or headers.get("title")
        credit_key = headers.get("credits") or headers.get("credit") or headers.get("kredit")
        prereq_key = headers.get("prerequisites") or headers.get("prerequisite") or headers.get("prereq") or headers.get("prasyarat")
        cat_key = headers.get("category") or headers.get("kategori")

        if not code_key or not name_key:
            return [], ["Missing required columns: 'course_code' and 'course_name' are mandatory."]

        slot_counter = 0
        seen_real_codes = set()
        for row_idx, row in enumerate(reader, start=2):
            raw_code = (row.get(code_key) or "").strip().upper().replace(" ", "")
            raw_name = (row.get(name_key) or "").strip().title()
            raw_credits = (row.get(credit_key) or "3").strip() if credit_key else "3"
            raw_prereqs = (row.get(prereq_key) or "").strip() if prereq_key else ""
            raw_category = (row.get(cat_key) or "").strip().title() if cat_key else ""

            if not raw_code:
                errors.append(f"Row {row_idx}: Empty course_code.")
                continue

            if not raw_name:
                errors.append(f"Row {row_idx}: Empty course_name.")
                continue

            # Validate credits as integer
            try:
                credits_int = int(float(raw_credits))
                if credits_int <= 0:
                    errors.append(f"Row {row_idx}: Invalid credit hours '{raw_credits}'. Must be positive.")
                    continue
            except (ValueError, TypeError):
                errors.append(f"Row {row_idx}: Invalid credits format '{raw_credits}'. Must be an integer.")
                continue

            # Determine if this row is an elective slot (contains '/' or 'XX')
            is_elective_slot = ("/" in raw_code) or ("XX" in raw_code)

            if is_elective_slot:
                # Slot parsing: split by '/'
                raw_patterns = [p.strip() for p in raw_code.split("/") if p.strip()]
                if not raw_patterns:
                    errors.append(f"Row {row_idx}: Invalid empty elective slot pattern '{raw_code}'.")
                    continue

                # Validate each pattern: must be uppercase alphanumeric (X is wildcard character)
                invalid_patterns = [p for p in raw_patterns if not re.fullmatch(r'^[A-Z0-9]+$', p)]
                if invalid_patterns:
                    errors.append(
                        f"Row {row_idx}: Invalid pattern '{invalid_patterns[0]}' in '{raw_code}'. "
                        f"Patterns must contain only alphanumeric characters."
                    )
                    continue

                slot_counter += 1
                slot_no = slot_counter
                category = raw_category if raw_category else "Elective"
                patterns = raw_patterns
            else:
                # Real course code validation: must be alphanumeric (e.g. SECJ1013)
                if not re.fullmatch(r'^[A-Z0-9]+$', raw_code):
                    errors.append(
                        f"Row {row_idx}: Invalid course code '{raw_code}'. Must contain only alphanumeric characters."
                    )
                    continue

                if raw_code in seen_real_codes:
                    errors.append(f"Row {row_idx}: Duplicate course code '{raw_code}'.")
                    continue
                seen_real_codes.add(raw_code)

                slot_no = None
                patterns = None
                category = raw_category if raw_category else "Core"

            prereq_struct = cls.parse_prerequisite_string(raw_prereqs)

            courses.append({
                "code": raw_code,
                "name": raw_name,
                "credits": credits_int,
                "category": category,
                "is_elective_slot": is_elective_slot,
                "slot_no": slot_no,
                "match_patterns": patterns,
                "prerequisites": prereq_struct
            })

        return courses, errors
