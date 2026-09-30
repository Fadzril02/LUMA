-- =============================================================================
-- Migration: 28_advisee_roster_grade_scales.sql
-- Description: Rewrite advisee_roster_summary view (migration 13) to dynamically
--              compute CGPA and earned credits by joining tenant grade_scales
--              (counts_in_cgpa / counts_as_completed) without hardcoded grade lists.
--
-- Free-tier safe: No new external services, no cron.
-- Transactional: BEGIN / COMMIT with full rollback instructions included.
-- DO NOT APPLY UNTIL EXPLICITLY APPROVED.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. REWRITE VIEW: advisee_roster_summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW advisee_roster_summary
WITH (security_invoker = true) AS
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
active_scales AS (
    -- Resolve effective grade scale definition per tenant and grade
    SELECT DISTINCT ON (tenant_id, UPPER(TRIM(grade)))
        tenant_id,
        UPPER(TRIM(grade)) AS grade,
        points,
        is_pass,
        counts_in_cgpa,
        counts_as_completed
    FROM grade_scales
    WHERE (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      AND effective_from <= CURRENT_DATE
    ORDER BY tenant_id, UPPER(TRIM(grade)), effective_from DESC
),
records_agg AS (
    SELECT
        ar.tenant_id,
        ar.matric_no,
        -- Credits counted toward completion via tenant grade_scales.counts_as_completed
        COALESCE(
            SUM(
                CASE 
                    WHEN gs.counts_as_completed = true AND (ar.prerequisite_met IS NOT FALSE) THEN ar.credits
                    WHEN gs.grade IS NULL AND ar.status IN ('Passed', 'Exempted') AND (ar.prerequisite_met IS NOT FALSE) THEN ar.credits
                    ELSE 0 
                END
            ), 
            0
        )::INT AS earned_credits_from_records,

        -- Credits passed
        COALESCE(
            SUM(
                CASE 
                    WHEN gs.is_pass = true THEN ar.credits
                    WHEN gs.grade IS NULL AND ar.status = 'Passed' THEN ar.credits
                    ELSE 0 
                END
            ), 
            0
        )::INT AS passed_credits,

        -- Failed courses count
        COUNT(
            CASE 
                WHEN gs.is_pass = false THEN 1
                WHEN gs.grade IS NULL AND ar.status = 'Failed' THEN 1
            END
        )::INT AS failed_count,

        COUNT(CASE WHEN ar.prerequisite_met = false THEN 1 END)::INT AS unmet_prereq_count,
        BOOL_OR(ar.prerequisite_met = false) AS has_unmet_prereq,

        -- CGPA: Sum(credits * points) / Sum(credits where counts_in_cgpa = true)
        -- Uses gs.points (with ar.grade_point fallback if missing scale row)
        ROUND(
            SUM(
                CASE 
                    WHEN gs.counts_in_cgpa = true THEN ar.credits * COALESCE(gs.points, ar.grade_point, 0)
                    WHEN gs.grade IS NULL AND ar.grade_point IS NOT NULL THEN ar.credits * ar.grade_point
                    ELSE 0 
                END
            ) / NULLIF(
                SUM(
                    CASE 
                        WHEN gs.counts_in_cgpa = true THEN ar.credits
                        WHEN gs.grade IS NULL AND ar.grade_point IS NOT NULL THEN ar.credits
                        ELSE 0 
                    END
                ), 
                0
            ),
            2
        ) AS calc_cgpa
    FROM academic_records ar
    LEFT JOIN active_scales gs 
        ON ar.tenant_id = gs.tenant_id 
       AND UPPER(TRIM(ar.grade)) = gs.grade
    GROUP BY ar.tenant_id, ar.matric_no
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
    s.tenant_id,
    s.entry_semester,
    s.block_exempted_credits,
    COALESCE(s.cgpa, r.calc_cgpa, 0.00)::NUMERIC(3, 2) AS current_cgpa,
    COALESCE(s.cgpa, r.calc_cgpa, 0.00)::NUMERIC(3, 2) AS cgpa,
    (COALESCE(r.earned_credits_from_records, la.audit_credits_earned, 0) + COALESCE(s.block_exempted_credits, 0))::INT AS total_earned_credits,
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
    la.last_audited_at,
    s.created_at
FROM students s
LEFT JOIN cohorts c ON s.cohort_id = c.id
LEFT JOIN latest_audits la ON s.matric_no = la.matric_no
LEFT JOIN records_agg r ON s.matric_no = r.matric_no AND s.tenant_id = r.tenant_id;

GRANT SELECT ON advisee_roster_summary TO authenticated, anon, service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (if ever applied and need to revert):
-- =============================================================================
-- BEGIN;
-- -- Re-run migration 13_advisee_roster_summary.sql definition to restore
-- -- the previous version of the view.
-- COMMIT;

-- =============================================================================
-- TEST QUERY & VERIFICATION SNIPPET: Advisee Roster RLS Isolation
-- =============================================================================
-- Because the view is created WITH (security_invoker = true), queries on the view
-- execute under the caller's identity (auth.uid()). The underlying tables' RLS
-- policies are strictly enforced:
--   - students: advisor_staff_id IN (SELECT my_staff_ids()) OR user_id = auth.uid()
--   - academic_records: (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
--   - degree_audits: advisor_staff_id IN (SELECT my_staff_ids()) OR matric_no IN (SELECT matric_no FROM my_matric_nos())
--   - grade_scales: tenant_id = my_tenant_id()
--
-- 1. Standalone Verification Query (run as an authenticated advisor):
-- -----------------------------------------------------------------------------
-- SELECT
--     matric_no,
--     student_name,
--     advisor_staff_id,
--     tenant_id,
--     current_cgpa,
--     total_earned_credits
-- FROM advisee_roster_summary;
--
-- Expected outcome:
--   Every returned row satisfies: advisor_staff_id IN (SELECT my_staff_ids()).
--   Students assigned to other advisors or belonging to other tenants are omitted.
--
-- 2. Automated DO Block Test (validates isolation under simulated advisor session):
-- -----------------------------------------------------------------------------
/*
DO $$
DECLARE
    v_test_advisor RECORD;
    v_total_view_rows INT;
    v_leaked_rows INT;
    v_direct_advisee_count INT;
BEGIN
    -- Pick an active advisor to test
    SELECT user_id, staff_id, tenant_id INTO v_test_advisor
    FROM advisors
    WHERE user_id IS NOT NULL AND staff_id IS NOT NULL
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE NOTICE 'No advisor found to test RLS on advisee_roster_summary.';
        RETURN;
    END IF;

    -- Impersonate the advisor as an authenticated user
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_test_advisor.user_id,
        'role', 'authenticated'
    )::text, true);

    -- Count total advisees visible in the security_invoker view
    SELECT COUNT(*) INTO v_total_view_rows FROM advisee_roster_summary;

    -- Count advisees from underlying students table matching my_staff_ids()
    SELECT COUNT(*) INTO v_direct_advisee_count
    FROM students
    WHERE advisor_staff_id IN (SELECT my_staff_ids());

    -- Count any leaked rows (where advisor_staff_id does not belong to this advisor)
    SELECT COUNT(*) INTO v_leaked_rows
    FROM advisee_roster_summary
    WHERE advisor_staff_id NOT IN (SELECT my_staff_ids());

    IF v_leaked_rows > 0 THEN
        RAISE EXCEPTION 'RLS LEAK DETECTED: advisee_roster_summary returned % rows belonging to other advisors!', v_leaked_rows;
    END IF;

    IF v_total_view_rows != v_direct_advisee_count THEN
        RAISE EXCEPTION 'RLS MISMATCH: view returned % rows but direct students query returned %', v_total_view_rows, v_direct_advisee_count;
    END IF;

    RAISE NOTICE 'SUCCESS: advisee_roster_summary WITH (security_invoker = true) correctly isolates % advisees for staff_id % (0 leaked rows).',
        v_total_view_rows, v_test_advisor.staff_id;
END $$;
*/

