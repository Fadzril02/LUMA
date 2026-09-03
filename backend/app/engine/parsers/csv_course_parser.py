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
            return {"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}

        cleaned = raw_prereqs.strip()
        
        # Check for min credits requirements
        min_credits = 0
        min_cred_match = re.search(r'(?:min_credits|credits?|jam\s*kredit)\s*[:=]?\s*([0-9]+)', cleaned, re.IGNORECASE)
        if min_cred_match:
            min_credits = int(min_cred_match.group(1))

        # Check for OR vs AND
        prereq_type = "OR" if " OR " in cleaned.upper() else "AND"

        # Extract Malaysian course codes (3-4 uppercase letters + 4 digits)
        course_codes = re.findall(r'\b[A-Z]{3,4}\s?[0-9]{4}\b', cleaned.upper())
        normalized_codes = [c.replace(" ", "") for c in course_codes]

        return {
            "type": prereq_type,
            "courses": list(dict.fromkeys(normalized_codes)),  # preserve order & unique
            "min_grade": "C",
            "min_credits": min_credits
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

        for row_idx, row in enumerate(reader, start=2):
            raw_code = (row.get(code_key) or "").strip().upper().replace(" ", "")
            raw_name = (row.get(name_key) or "").strip().title()
            raw_credits = (row.get(credit_key) or "3").strip() if credit_key else "3"
            raw_prereqs = (row.get(prereq_key) or "").strip() if prereq_key else ""
            raw_category = (row.get(cat_key) or "Core").strip().title() if cat_key else "Core"

            if not raw_code:
                errors.append(f"Row {row_idx}: Empty course_code skipped.")
                continue

            # Validate credits as integer
            try:
                credits_int = int(float(raw_credits))
            except ValueError:
                credits_int = 3

            prereq_struct = cls.parse_prerequisite_string(raw_prereqs)

            courses.append({
                "code": raw_code,
                "name": raw_name,
                "credits": credits_int,
                "category": raw_category,
                "prerequisites": prereq_struct
            })

        return courses, errors
