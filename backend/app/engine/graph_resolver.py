"""
[PROJECT_NAME] Prerequisite Graph & Traffic Light Audit Resolver
Company: [COMPANY_NAME]
"""

from typing import List, Dict, Any, Set
from backend.app.schemas.audit import (
    ParsedLineItem,
    CourseAuditResult,
    AuditSummary
)


DEFAULT_DOMAINS = [
    "Logic & Math",
    "Core Development",
    "Systems & Architecture",
    "Soft Skills",
    "Project Management"
]

NEUTRAL_PASSING_GRADES = {"HL", "PC", "EX"}


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
            prereq_courses: List[str] = prereq_config.get("courses", [])
            min_credits_required: int = prereq_config.get("min_credits", 0)
            
            missing: List[str] = []
            
            if prereq_type == "AND":
                for prereq in prereq_courses:
                    clean_prereq = prereq.replace(" ", "").upper()
                    if clean_prereq not in passed_courses:
                        missing.append(clean_prereq)
            elif prereq_type == "OR" and prereq_courses:
                has_any = any(p.replace(" ", "").upper() in passed_courses for p in prereq_courses)
                if not has_any:
                    missing.extend([p.replace(" ", "").upper() for p in prereq_courses])

            # Check minimum credit hours threshold if specified
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
