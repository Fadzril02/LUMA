-- ==============================================================================
-- Migration: Advisee Roster Summary View
-- Version: 13_advisee_roster_summary.sql
-- Description:
--   Pre-aggregates students, cohorts, degree_audits, and academic_records into
--   a single performant view to eliminate N+1 queries on Advisor Dashboard.
-- ==============================================================================

CREATE OR REPLACE VIEW advisee_roster_summary AS
WITH latest_audits AS (
    SELECT DISTINCT ON (matric_no)
        id AS latest_audit_id,
        matric_no,
        advisor_staff_id,
        total_credits_earned AS audit_credits_earned,
        traffic_light_status,
        unmet_prerequisites_count,
        failed_courses_count,
        audit_summary,
        created_at AS last_audited_at
    FROM degree_audits
    ORDER BY matric_no, created_at DESC
),
records_agg AS (
    SELECT
        matric_no,
        COALESCE(SUM(CASE WHEN status IN ('Passed', 'Exempted') AND prerequisite_met = true THEN credits ELSE 0 END), 0)::INT AS earned_credits_from_records,
        COALESCE(SUM(CASE WHEN status = 'Passed' THEN credits ELSE 0 END), 0)::INT AS passed_credits,
        COUNT(CASE WHEN status = 'Failed' THEN 1 END)::INT AS failed_count,
        COUNT(CASE WHEN prerequisite_met = false THEN 1 END)::INT AS unmet_prereq_count,
        BOOL_OR(prerequisite_met = false) AS has_unmet_prereq,
        ROUND(
            SUM(credits * grade_point) / NULLIF(SUM(CASE WHEN grade NOT IN ('TD', 'TS') THEN credits ELSE 0 END), 0),
            2
        ) AS calc_cgpa
    FROM academic_records
    GROUP BY matric_no
)
SELECT
    s.matric_no,
    s.name AS student_name,
    s.name,
    s.advisor_staff_id,
    c.cohort_code,
    c.cohort_name,
    s.cohort_id,
    s.program,
    s.syllabus_type,
    s.institutional_email,
    s.user_id,
    COALESCE(s.cgpa, r.calc_cgpa, 0.00)::NUMERIC(3, 2) AS current_cgpa,
    COALESCE(s.cgpa, r.calc_cgpa, 0.00)::NUMERIC(3, 2) AS cgpa,
    COALESCE(r.earned_credits_from_records, la.audit_credits_earned, 0)::INT AS total_earned_credits,
    COALESCE(
        s.academic_status, 
        CASE 
            WHEN COALESCE(s.cgpa, r.calc_cgpa, 0.00) < 2.00 THEN 'Probation'
            WHEN COALESCE(s.cgpa, r.calc_cgpa, 0.00) < 2.50 THEN 'At-Risk'
            ELSE 'Good Standing'
        END
    ) AS academic_status,
    COALESCE(
        la.traffic_light_status,
        CASE 
            WHEN r.has_unmet_prereq = true OR COALESCE(s.cgpa, r.calc_cgpa, 0.00) < 2.00 THEN 'RED'
            WHEN COALESCE(s.cgpa, r.calc_cgpa, 0.00) < 2.50 OR r.failed_count > 0 THEN 'YELLOW'
            ELSE 'GREEN'
        END
    ) AS traffic_light_status,
    COALESCE(
        la.traffic_light_status,
        CASE 
            WHEN r.has_unmet_prereq = true OR COALESCE(s.cgpa, r.calc_cgpa, 0.00) < 2.00 THEN 'RED'
            WHEN COALESCE(s.cgpa, r.calc_cgpa, 0.00) < 2.50 OR r.failed_count > 0 THEN 'YELLOW'
            ELSE 'GREEN'
        END
    ) AS traffic_light,
    COALESCE(la.unmet_prerequisites_count, r.unmet_prereq_count, 0)::INT AS unmet_prerequisites_count,
    COALESCE(la.failed_courses_count, r.failed_count, 0)::INT AS failed_courses_count,
    la.audit_summary,
    la.latest_audit_id,
    la.last_audited_at
FROM students s
LEFT JOIN cohorts c ON s.cohort_id = c.id
LEFT JOIN latest_audits la ON s.matric_no = la.matric_no
LEFT JOIN records_agg r ON s.matric_no = r.matric_no;

GRANT SELECT ON advisee_roster_summary TO authenticated, anon, service_role;
