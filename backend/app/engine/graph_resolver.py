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
    from app.engine.grading import (
        GradingScale,
        compute_cgpa as grading_compute_cgpa,
        compute_completed_credits,
        select_attempts_by_repeat_policy
    )
except ImportError:
    from backend.app.schemas.audit import (
        ParsedLineItem,
        CourseAuditResult,
        AuditSummary
    )
    from backend.app.engine.grading import (
        GradingScale,
        compute_cgpa as grading_compute_cgpa,
        compute_completed_credits,
        select_attempts_by_repeat_policy
    )


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
    min_grade: Optional[str],
    scale: GradingScale
) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a student satisfies an individual prerequisite course requirement.
    
    Evaluation Rules:
    1. The prerequisite course must be present in passed_courses (status in ['Passed', 'Exempted']).
    2. Neutral passing grades ('HL', 'PC', 'EX', 'CT') signify credit transfer / exemptions and always
       satisfy the prerequisite regardless of min_grade.
    3. If min_grade is specified, evaluates rank using tenant GradingScale.
    4. If min_grade is None, empty, or 'ANY', any passing grade satisfies the requirement.
    5. An unknown grade or min_grade raises ValueError (fail loud; never turn into a False result).
    
    Returns:
        (is_satisfied: bool, failure_reason: Optional[str])
    """
    if scale is None:
        raise ValueError("scale (GradingScale) is required for check_course_prerequisite_satisfied.")

    clean_code = prereq_code.replace(" ", "").upper()
    
    # 1. Course must be completed / passed
    if clean_code not in passed_courses:
        return False, clean_code

    student_record = passed_courses[clean_code]
    student_grade = student_record.grade.upper()

    # Raises ValueError on unknown grade/min_grade
    satisfied = scale.meets_min_grade(student_grade, min_grade, clean_code)
    if not satisfied:
        req_label = str(min_grade).strip().upper() if min_grade else "Passing"
        return False, f"{clean_code} (Earned grade {student_grade} < Required min grade {req_label})"
    return True, None


class PrerequisiteGraphResolver:
    @staticmethod
    def audit_student_records(
        records: List[ParsedLineItem],
        course_catalog: Dict[str, Dict[str, Any]],
        scale: GradingScale,
        total_required_credits: int = 0,
        min_cgpa_threshold: float = 2.00,
        block_exempted_credits: int = 0,
        repeat_policy: str = "latest",
        return_all_attempts: bool = False
    ) -> Any:
        """
        Runs pure Python graph traversal & set validation on parsed courses against course catalog.
        Categorizes each course into Traffic Light Matrix (GREEN, YELLOW, RED) and computes 5-domain radar scores.

        scale: Required tenant GradingScale instance.
        repeat_policy: 'latest' vs 'best' for selecting active attempt per course.
        """
        if scale is None:
            raise ValueError("scale (GradingScale) is a required parameter for audit_student_records.")

        # Map of passed/exempted courses: use attempt chosen by repeat_policy
        passed_courses: Dict[str, ParsedLineItem] = {}
        chosen_input_records = select_attempts_by_repeat_policy(records, scale, repeat_policy)
        for rec in chosen_input_records:
            clean_code = rec.course_code.replace(" ", "").upper()
            if rec.status in ["Passed", "Exempted"]:
                passed_courses[clean_code] = rec

        earned_credits_for_gates = compute_completed_credits(
            chosen_input_records, scale, block_exempted_credits=block_exempted_credits
        )

        audited_results: List[CourseAuditResult] = []
        ai_used = any(r.is_ai_parsed for r in records)

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
                        min_grade=effective_min_grade,
                        scale=scale
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
                        min_grade=effective_min_grade,
                        scale=scale
                    )
                    if satisfied:
                        or_satisfied = True
                        break
                    elif failure_reason:
                        or_reasons.append(failure_reason)
                
                if not or_satisfied:
                    missing.extend(or_reasons)

            # 3. Minimum credit hours threshold gate
            if min_credits_required > 0 and earned_credits_for_gates < min_credits_required:
                missing.append(f"Requires {min_credits_required} Credits Earned")

            prerequisite_met = len(missing) == 0

            # Traffic Light Matrix Assignment
            if rec.status == "Failed":
                traffic_light = "RED"
            elif not prerequisite_met:
                traffic_light = "RED"
            elif rec.status == "In-Progress":
                traffic_light = "YELLOW"
            else:
                traffic_light = "GREEN"

            audited_results.append(CourseAuditResult(
                course_code=rec.course_code,
                course_name=rec.course_name,
                credits=rec.credits,
                grade=rec.grade,
                grade_point=rec.grade_point,
                semester=rec.semester,
                status=rec.status,
                warning=getattr(rec, "warning", None),
                domain=domain,
                traffic_light=traffic_light,
                prerequisite_met=prerequisite_met,
                missing_prerequisites=missing,
                is_ai_parsed=rec.is_ai_parsed,
                raw_extracted_text=rec.raw_extracted_text
            ))

        # Filter display records: per course, show attempt chosen by repeat_policy
        display_results = select_attempts_by_repeat_policy(audited_results, scale, repeat_policy)

        # Domain accumulator for Radar Chart: computed strictly from chosen display attempts
        domain_grades: Dict[str, List[float]] = {d: [] for d in DEFAULT_DOMAINS}
        failed_count = 0
        in_progress_count = 0
        unmet_prereqs_count = 0
        passed_count = 0

        for r in display_results:
            if scale.counts_in_cgpa(r.grade, r.course_code) and r.status in ["Passed", "Failed"]:
                domain_grades[r.domain].append(r.grade_point)
            if r.status == "Failed":
                failed_count += 1
            elif not r.prerequisite_met:
                unmet_prereqs_count += 1
            elif r.status == "In-Progress":
                in_progress_count += 1
            elif r.status in ["Passed", "Exempted"]:
                passed_count += 1

        # Calculate Final CGPA & Completed Credits via grading engine
        cgpa = grading_compute_cgpa(records, scale, repeat_policy=repeat_policy)
        total_credits_earned = compute_completed_credits(records, scale, block_exempted_credits=block_exempted_credits)

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
            passed_courses_count=passed_count,
            failed_courses_count=failed_count,
            in_progress_courses_count=in_progress_count,
            unmet_prerequisites_count=unmet_prereqs_count,
            academic_standing=academic_standing,
            ai_fallback_used=ai_used,
            radar_stats=radar_stats
        )

        if return_all_attempts:
            return display_results, summary, audited_results
        return display_results, summary
