"""
Smart Academic Assessment System - Prerequisite Graph & Traffic Light Audit Resolver
"""

from typing import List, Dict, Any, Set, Tuple, Optional
try:
    from app.schemas.audit import (
        ParsedLineItem,
        CourseAuditResult,
        AuditSummary
    )
    from app.engine.parsers.malaysian_regex import GRADE_POINTS, NEUTRAL_PASSING_GRADES
except ImportError:
    from backend.app.schemas.audit import (
        ParsedLineItem,
        CourseAuditResult,
        AuditSummary
    )
    from backend.app.engine.parsers.malaysian_regex import GRADE_POINTS, NEUTRAL_PASSING_GRADES


DEFAULT_DOMAINS = [
    "Logic & Math",
    "Core Development",
    "Systems & Architecture",
    "Soft Skills",
    "Project Management"
]


def infer_course_domain(code: str, name: str, category: str = "") -> str:
    """
    Classifies a Malaysian university course into 1 of 5 standard curriculum domains.
    """
    text = f"{code} {name} {category}".upper()
    if any(k in text for k in ["MATH", "DISCRETE", "STATISTIC", "CALCULUS", "NUMERICAL", "LOGIC", "SECP1513", "SECV1113"]):
        return "Logic & Math"
    elif any(k in text for k in ["NETWORK", "OPERATING", "ARCHITECTURE", "SYSTEM", "SECURITY", "HARDWARE", "CLOUD", "SECR"]):
        return "Systems & Architecture"
    elif any(k in text for k in ["PROJECT", "MANAGEMENT", "MANAGERIAL", "FINAL YEAR", "FYP", "LATIHAN", "INTERNSHIP", "SECJ3303", "SECJ3032", "SECJ4044", "SECJ4118", "SECJ4124"]):
        return "Project Management"
    elif any(k in text for k in ["ETHIC", "PHILOSOPHY", "COMMUNICATION", "ENGLISH", "ATTRIBUTES", "TAMADUN", "HUBUNGAN", "UHMS", "UHMT", "UHLB", "UKQF", "SOFT"]):
        return "Soft Skills"
    else:
        return "Core Development"


def check_course_prerequisite_satisfied(
    prereq_code: str,
    passed_courses: Dict[str, ParsedLineItem],
    min_grade: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a student satisfies an individual prerequisite course requirement.
    
    Evaluation Rules:
    1. The prerequisite course must be present in passed_courses (status in ['Passed', 'Exempted']).
    2. Neutral passing grades ('HL', 'PC', 'EX') signify credit transfer / exemptions and always
       satisfy the prerequisite regardless of min_grade.
    3. If min_grade is specified (e.g., 'C', 'B'), the student's earned letter grade is checked
       against the required threshold using GRADE_POINTS. A pass below the required grade
       (e.g., earned 'D' with GP 1.00 when 'C' with GP 2.00 is required) does NOT satisfy the rule.
    4. If min_grade is None, empty, or 'ANY', any passing grade satisfies the requirement.
    
    Returns:
        (is_satisfied: bool, failure_reason: Optional[str])
    """
    clean_code = prereq_code.replace(" ", "").upper()
    
    # 1. Course must be completed / passed
    if clean_code not in passed_courses:
        return False, clean_code

    student_record = passed_courses[clean_code]
    student_grade = student_record.grade.upper()

    # 2. Neutral passing grades (HL, PC, EX) always satisfy prerequisites
    if student_grade in NEUTRAL_PASSING_GRADES:
        return True, None

    # 3. If min_grade is specified, evaluate grade point threshold
    if min_grade and min_grade.strip().upper() not in {"", "NONE", "ANY"}:
        required_min_grade = min_grade.strip().upper()
        min_required_gp = GRADE_POINTS.get(required_min_grade, 2.00)  # Default to 'C' (2.00) if unmapped
        
        # Student earned grade point
        student_gp = student_record.grade_point if student_record.grade_point > 0.0 else GRADE_POINTS.get(student_grade, 0.00)
        
        if student_gp < min_required_gp:
            return False, f"{clean_code} (Earned grade {student_grade} < Required min grade {required_min_grade})"

    # 4. Default: Any passing grade satisfies prerequisite
    return True, None


class PrerequisiteGraphResolver:
    @staticmethod
    def audit_student_records(
        records: List[ParsedLineItem],
        course_catalog: Dict[str, Dict[str, Any]],
        total_required_credits: int = 130,
        min_cgpa_threshold: float = 2.00
    ) -> tuple[List[CourseAuditResult], AuditSummary]:
        """
        Runs pure Python graph traversal & set validation on parsed courses against course catalog.
        Categorizes each course into Traffic Light Matrix (GREEN, YELLOW, RED) and computes 5-domain radar scores.
        """
        # Map of passed/exempted courses: code -> ParsedLineItem
        passed_courses: Dict[str, ParsedLineItem] = {}
        for rec in records:
            clean_code = rec.course_code.replace(" ", "").upper()
            if rec.status in ["Passed", "Exempted"]:
                passed_courses[clean_code] = rec

        audited_results: List[CourseAuditResult] = []
        total_credits_earned = 0
        total_grade_points = 0.0
        gpa_credits = 0
        
        failed_count = 0
        in_progress_count = 0
        unmet_prereqs_count = 0
        ai_used = any(r.is_ai_parsed for r in records)

        # Domain accumulator for Radar Chart: domain -> list of grade points
        domain_grades: Dict[str, List[float]] = {d: [] for d in DEFAULT_DOMAINS}

        for rec in records:
            code = rec.course_code.replace(" ", "").upper()
            course_def = course_catalog.get(code, {})
            prereq_config = course_def.get("prerequisites", {"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0})
            
            # Domain Determination
            domain = course_def.get("domain") or infer_course_domain(code, rec.course_name, course_def.get("category", ""))
            if domain not in DEFAULT_DOMAINS:
                domain = "Core Development"

            # Prerequisite Evaluation
            prereq_type = prereq_config.get("type", "AND").upper()
            prereq_courses: List[Any] = prereq_config.get("courses", [])
            global_min_grade: Optional[str] = prereq_config.get("min_grade")
            min_credits_required: int = prereq_config.get("min_credits", 0)
            
            missing: List[str] = []

            def _parse_prereq_item(item: Any) -> tuple[str, Optional[str]]:
                if isinstance(item, dict):
                    c_code = (item.get("course_code") or item.get("code") or "").replace(" ", "").upper()
                    m_grade = item.get("min_grade") or global_min_grade
                    return c_code, m_grade
                elif isinstance(item, str):
                    return item.replace(" ", "").upper(), global_min_grade
                return str(item).replace(" ", "").upper(), global_min_grade

            # 1. AND Logic: ALL prerequisite courses must meet minimum grade requirement
            if prereq_type == "AND":
                for prereq_item in prereq_courses:
                    clean_prereq, effective_min_grade = _parse_prereq_item(prereq_item)
                    satisfied, failure_reason = check_course_prerequisite_satisfied(
                        prereq_code=clean_prereq,
                        passed_courses=passed_courses,
                        min_grade=effective_min_grade
                    )
                    if not satisfied and failure_reason:
                        missing.append(failure_reason)

            # 2. OR Logic: AT LEAST ONE prerequisite course must meet minimum grade requirement
            elif prereq_type == "OR" and prereq_courses:
                or_satisfied = False
                or_reasons = []
                for prereq_item in prereq_courses:
                    clean_prereq, effective_min_grade = _parse_prereq_item(prereq_item)
                    satisfied, failure_reason = check_course_prerequisite_satisfied(
                        prereq_code=clean_prereq,
                        passed_courses=passed_courses,
                        min_grade=effective_min_grade
                    )
                    if satisfied:
                        or_satisfied = True
                        break
                    elif failure_reason:
                        or_reasons.append(failure_reason)
                
                if not or_satisfied:
                    missing.extend(or_reasons)

            # 3. Minimum credit hours threshold gate
            if min_credits_required > 0 and total_credits_earned < min_credits_required:
                missing.append(f"Requires {min_credits_required} Credits Earned")

            prerequisite_met = len(missing) == 0

            # Traffic Light Matrix Assignment
            if rec.status == "Failed":
                traffic_light = "RED"
                failed_count += 1
            elif not prerequisite_met:
                traffic_light = "RED"
                unmet_prereqs_count += 1
            elif rec.status == "In-Progress":
                traffic_light = "YELLOW"
                in_progress_count += 1
            else:
                traffic_light = "GREEN"

            # Neutral passing grades (HL, PC, EX) grant credits & clear prereqs, but are EXCLUDED from GPA and radar math
            is_neutral_grade = rec.grade.upper() in NEUTRAL_PASSING_GRADES

            if rec.status in ["Passed", "Exempted"]:
                total_credits_earned += rec.credits

            if not is_neutral_grade and rec.status in ["Passed", "Failed"]:
                total_grade_points += (rec.grade_point * rec.credits)
                gpa_credits += rec.credits
                domain_grades[domain].append(rec.grade_point)

            audited_results.append(CourseAuditResult(
                course_code=rec.course_code,
                course_name=rec.course_name,
                credits=rec.credits,
                grade=rec.grade,
                grade_point=rec.grade_point,
                semester=rec.semester,
                status=rec.status,
                domain=domain,
                traffic_light=traffic_light,
                prerequisite_met=prerequisite_met,
                missing_prerequisites=missing,
                is_ai_parsed=rec.is_ai_parsed,
                raw_extracted_text=rec.raw_extracted_text
            ))

        # Calculate Final CGPA
        cgpa = round(total_grade_points / gpa_credits, 2) if gpa_credits > 0 else 0.00

        # Calculate 5-Domain Radar Stats (0.0 - 4.0)
        radar_stats: Dict[str, float] = {}
        for d in DEFAULT_DOMAINS:
            scores = domain_grades[d]
            radar_stats[d] = round(sum(scores) / len(scores), 2) if scores else 0.00

        # Overall Status
        if failed_count > 0 or unmet_prereqs_count > 0 or cgpa < min_cgpa_threshold:
            overall_traffic_light = "RED"
            academic_standing = "Probation / At-Risk" if cgpa < min_cgpa_threshold else "Prerequisite Alert"
        elif in_progress_count > 0:
            overall_traffic_light = "YELLOW"
            academic_standing = "Good Standing (Active)"
        else:
            overall_traffic_light = "GREEN"
            academic_standing = "Good Standing"

        summary = AuditSummary(
            total_credits_required=total_required_credits,
            total_credits_earned=total_credits_earned,
            cgpa=cgpa,
            overall_traffic_light=overall_traffic_light,
            passed_courses_count=len(passed_courses),
            failed_courses_count=failed_count,
            in_progress_courses_count=in_progress_count,
            unmet_prerequisites_count=unmet_prereqs_count,
            academic_standing=academic_standing,
            ai_fallback_used=ai_used,
            radar_stats=radar_stats
        )

        return audited_results, summary
