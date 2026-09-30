-- =============================================================================
-- Migration: 26_grading_scales.sql
-- Description: Per-university grading scale, presets, repeat policy, student
--              entry semester, and exemption audit tracking.
--
-- Free-tier safe: No new services, no cron.
-- Transactional: BEGIN / COMMIT with full rollback instructions included.
-- DO NOT APPLY UNTIL EXPLICITLY APPROVED.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TENANTS: Repeat policy (latest vs best)
-- -----------------------------------------------------------------------------
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS repeat_policy TEXT NOT NULL DEFAULT 'latest' 
CHECK (repeat_policy IN ('latest', 'best'));

-- -----------------------------------------------------------------------------
-- 2. STUDENTS: Entry semester (>= 1)
-- -----------------------------------------------------------------------------
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS entry_semester INT NOT NULL DEFAULT 1 
CHECK (entry_semester >= 1);

-- -----------------------------------------------------------------------------
-- 3. SECURITY DEFINER HELPER: my_tenant_id()
-- Resolves the tenant_id for the authenticated user (advisor or student).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM advisors WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM students WHERE user_id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION my_tenant_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_tenant_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. GRADE_SCALES: Per-tenant grading scale table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grade_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    grade TEXT NOT NULL,
    points NUMERIC(3,2) NULL,
    rank INT NULL,
    min_mark INT NULL,
    max_mark INT NULL,
    achievement_label TEXT NULL,
    is_pass BOOLEAN NOT NULL,
    counts_in_cgpa BOOLEAN NOT NULL,
    counts_as_completed BOOLEAN NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_grade_scales_tenant_grade_effective UNIQUE (tenant_id, grade, effective_from)
);

ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;

-- Authenticated SELECT on own tenant only
CREATE POLICY "grade_scales_tenant_select"
ON grade_scales FOR SELECT
TO authenticated
USING (tenant_id = my_tenant_id());

-- No write policies for authenticated (mutations restricted to service_role / db admin)

-- -----------------------------------------------------------------------------
-- 5. GRADE_SCALE_PRESETS: Standard presets for easy tenant onboarding
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grade_scale_presets (
    preset_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    points NUMERIC(3,2) NULL,
    rank INT NULL,
    min_mark INT NULL,
    max_mark INT NULL,
    achievement_label TEXT NULL,
    is_pass BOOLEAN NOT NULL,
    counts_in_cgpa BOOLEAN NOT NULL,
    counts_as_completed BOOLEAN NOT NULL,
    PRIMARY KEY (preset_name, grade)
);

-- Seed Preset 1: "MY 4.00 with A+"
-- CONFIRM WITH OWNER
INSERT INTO grade_scale_presets (preset_name, grade, points, rank, min_mark, max_mark, achievement_label, is_pass, counts_in_cgpa, counts_as_completed) VALUES
('MY 4.00 with A+', 'A+', 4.00, 1, 90, 100, 'Excellent Pass', true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'A',  4.00, 2, 80, 89,  'Excellent Pass', true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'A-', 3.67, 3, 75, 79,  'Excellent Pass', true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'B+', 3.33, 4, 70, 74,  'Good Pass',      true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'B',  3.00, 5, 65, 69,  'Good Pass',      true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'B-', 2.67, 6, 60, 64,  'Good Pass',      true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'C+', 2.33, 7, 55, 59,  'Pass',           true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'C',  2.00, 8, 50, 54,  'Pass',           true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'C-', 1.67, 9, 45, 49,  'Pass',           true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'D+', 1.33, 10, 40, 44, 'Minimum Pass',   true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'D',  1.00, 11, 35, 39, 'Fail',           false, true, false), -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'D-', 0.67, 12, 30, 34, 'Fail',           false, true, false), -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'E',  0.00, 13, 0,  29, 'Fail',           false, true, false), -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'HL', NULL, NULL, NULL, NULL, 'Pass (non-graded)', true, false, true), -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'EX', NULL, NULL, NULL, NULL, 'Exempted',          true, false, true), -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'CT', NULL, NULL, NULL, NULL, 'Credit Transfer',  true, false, true), -- CONFIRM WITH OWNER
('MY 4.00 with A+', 'TD', NULL, NULL, NULL, NULL, 'Withdrawn',        false, false, false),-- CONFIRM WITH OWNER
('MY 4.00 with A+', 'TS', NULL, NULL, NULL, NULL, 'Incomplete',       false, false, false) -- CONFIRM WITH OWNER
ON CONFLICT (preset_name, grade) DO UPDATE SET
    points = EXCLUDED.points,
    rank = EXCLUDED.rank,
    min_mark = EXCLUDED.min_mark,
    max_mark = EXCLUDED.max_mark,
    achievement_label = EXCLUDED.achievement_label,
    is_pass = EXCLUDED.is_pass,
    counts_in_cgpa = EXCLUDED.counts_in_cgpa,
    counts_as_completed = EXCLUDED.counts_as_completed;

-- Seed Preset 2: "MY 4.00 without A+"
-- CONFIRM WITH OWNER
INSERT INTO grade_scale_presets (preset_name, grade, points, rank, min_mark, max_mark, achievement_label, is_pass, counts_in_cgpa, counts_as_completed) VALUES
('MY 4.00 without A+', 'A',  4.00, 1, 80, 100, 'Excellent Pass', true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'A-', 3.67, 2, 75, 79,  'Excellent Pass', true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'B+', 3.33, 3, 70, 74,  'Good Pass',      true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'B',  3.00, 4, 65, 69,  'Good Pass',      true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'B-', 2.67, 5, 60, 64,  'Good Pass',      true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'C+', 2.33, 6, 55, 59,  'Pass',           true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'C',  2.00, 7, 50, 54,  'Pass',           true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'C-', 1.67, 8, 45, 49,  'Pass',           true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'D+', 1.33, 9, 40, 44,  'Minimum Pass',   true, true, true),   -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'D',  1.00, 10, 35, 39, 'Fail',           false, true, false), -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'D-', 0.67, 11, 30, 34, 'Fail',           false, true, false), -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'E',  0.00, 12, 0,  29, 'Fail',           false, true, false), -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'HL', NULL, NULL, NULL, NULL, 'Pass (non-graded)', true, false, true), -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'EX', NULL, NULL, NULL, NULL, 'Exempted',          true, false, true), -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'CT', NULL, NULL, NULL, NULL, 'Credit Transfer',  true, false, true), -- CONFIRM WITH OWNER
('MY 4.00 without A+', 'TD', NULL, NULL, NULL, NULL, 'Withdrawn',        false, false, false),-- CONFIRM WITH OWNER
('MY 4.00 without A+', 'TS', NULL, NULL, NULL, NULL, 'Incomplete',       false, false, false) -- CONFIRM WITH OWNER
ON CONFLICT (preset_name, grade) DO UPDATE SET
    points = EXCLUDED.points,
    rank = EXCLUDED.rank,
    min_mark = EXCLUDED.min_mark,
    max_mark = EXCLUDED.max_mark,
    achievement_label = EXCLUDED.achievement_label,
    is_pass = EXCLUDED.is_pass,
    counts_in_cgpa = EXCLUDED.counts_in_cgpa,
    counts_as_completed = EXCLUDED.counts_as_completed;

-- -----------------------------------------------------------------------------
-- 6. SQL FUNCTION: clone_preset_to_tenant
-- Copies rows from grade_scale_presets into grade_scales for a tenant.
-- Callable only by service_role.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clone_preset_to_tenant(
    p_preset_name TEXT,
    p_tenant_id TEXT,
    p_effective_from DATE DEFAULT CURRENT_DATE
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted_count INT := 0;
    v_jwt_claims TEXT;
    v_jwt_role TEXT;
BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true);
    IF v_jwt_claims IS NOT NULL AND v_jwt_claims <> '' THEN
        v_jwt_role := v_jwt_claims::json->>'role';
        IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
            RAISE EXCEPTION 'clone_preset_to_tenant is restricted to service_role callers.';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Target tenant % does not exist in tenants table.', p_tenant_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM grade_scale_presets WHERE preset_name = p_preset_name) THEN
        RAISE EXCEPTION 'Grade scale preset % does not exist.', p_preset_name;
    END IF;

    INSERT INTO grade_scales (
        tenant_id,
        grade,
        points,
        rank,
        min_mark,
        max_mark,
        achievement_label,
        is_pass,
        counts_in_cgpa,
        counts_as_completed,
        effective_from
    )
    SELECT
        p_tenant_id,
        grade,
        points,
        rank,
        min_mark,
        max_mark,
        achievement_label,
        is_pass,
        counts_in_cgpa,
        counts_as_completed,
        p_effective_from
    FROM grade_scale_presets
    WHERE preset_name = p_preset_name
    ON CONFLICT (tenant_id, grade, effective_from) DO UPDATE SET
        points = EXCLUDED.points,
        rank = EXCLUDED.rank,
        min_mark = EXCLUDED.min_mark,
        max_mark = EXCLUDED.max_mark,
        achievement_label = EXCLUDED.achievement_label,
        is_pass = EXCLUDED.is_pass,
        counts_in_cgpa = EXCLUDED.counts_in_cgpa,
        counts_as_completed = EXCLUDED.counts_as_completed;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION clone_preset_to_tenant(TEXT, TEXT, DATE) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION clone_preset_to_tenant(TEXT, TEXT, DATE) TO service_role;

-- -----------------------------------------------------------------------------
-- 7. UTM SEED: Active and verbatim insert for tenant 'UTM'
-- -----------------------------------------------------------------------------
INSERT INTO grade_scales (tenant_id, grade, points, rank, min_mark, max_mark, achievement_label, is_pass, counts_in_cgpa, counts_as_completed, effective_from) VALUES
('UTM','A+',4.00,1,90,100,'Excellent Pass',true,true,true,'2000-01-01'),
('UTM','A',4.00,2,80,89,'Excellent Pass',true,true,true,'2000-01-01'),
('UTM','A-',3.67,3,75,79,'Excellent Pass',true,true,true,'2000-01-01'),
('UTM','B+',3.33,4,70,74,'Good Pass',true,true,true,'2000-01-01'),
('UTM','B',3.00,5,65,69,'Good Pass',true,true,true,'2000-01-01'),
('UTM','B-',2.67,6,60,64,'Good Pass',true,true,true,'2000-01-01'),
('UTM','C+',2.33,7,55,59,'Pass',true,true,true,'2000-01-01'),
('UTM','C',2.00,8,50,54,'Pass',true,true,true,'2000-01-01'),
('UTM','C-',1.67,9,45,49,'Pass',true,true,true,'2000-01-01'),
('UTM','D+',1.33,10,40,44,'Minimum Pass',true,true,true,'2000-01-01'),
('UTM','D',1.00,11,35,39,'Fail',false,true,false,'2000-01-01'),
('UTM','D-',0.67,12,30,34,'Fail',false,true,false,'2000-01-01'),
('UTM','E',0.00,13,0,29,'Fail',false,true,false,'2000-01-01'),
('UTM','HL',NULL,NULL,NULL,NULL,'Pass (non-graded)',true,false,true,'2000-01-01'),
('UTM','EX',NULL,NULL,NULL,NULL,'Exempted',true,false,true,'2000-01-01'),
('UTM','CT',NULL,NULL,NULL,NULL,'Credit Transfer',true,false,true,'2000-01-01'),
('UTM','TD',NULL,NULL,NULL,NULL,'Withdrawn',false,false,false,'2000-01-01'),
('UTM','TS',NULL,NULL,NULL,NULL,'Incomplete',false,false,false,'2000-01-01');

-- -----------------------------------------------------------------------------
-- 8. TRIGGER UPDATE: protect_student_identity_columns
-- Enforces that entry_semester and block_exempted_credits (along with other
-- core student identity columns) remain strictly service_role only.
-- Advisors modify them exclusively via PATCH /api/v1/students/{matric_no}/exemptions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_student_identity_columns()
RETURNS TRIGGER AS $$
DECLARE
    jwt_claims TEXT;
    jwt_role TEXT;
BEGIN
    jwt_claims := current_setting('request.jwt.claims', true);

    -- Allow direct DB / SQL Editor connections without JWT context
    IF jwt_claims IS NULL OR jwt_claims = '' THEN
        RETURN NEW;
    END IF;

    jwt_role := jwt_claims::json->>'role';

    -- Allow backend service_role operations
    IF jwt_role = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Block modification of protected student columns (strictly service_role only)
    IF (NEW.matric_no IS DISTINCT FROM OLD.matric_no) OR
       (NEW.advisor_staff_id IS DISTINCT FROM OLD.advisor_staff_id) OR
       (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) OR
       (NEW.user_id IS DISTINCT FROM OLD.user_id) OR
       (NEW.cgpa IS DISTINCT FROM OLD.cgpa) OR
       (NEW.academic_status IS DISTINCT FROM OLD.academic_status) OR
       (NEW.audit_status IS DISTINCT FROM OLD.audit_status) OR
       (NEW.graduation_credit_requirement IS DISTINCT FROM OLD.graduation_credit_requirement) OR
       (NEW.block_exempted_credits IS DISTINCT FROM OLD.block_exempted_credits) OR
       (NEW.entry_semester IS DISTINCT FROM OLD.entry_semester) THEN
        RAISE EXCEPTION 'Restricted operation: modification of protected student columns (matric_no, advisor_staff_id, tenant_id, user_id, cgpa, academic_status, audit_status, graduation_credit_requirement, block_exempted_credits, entry_semester) is restricted to service_role or database administrators.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 9. EXEMPTION_AUDIT: Audit log table for exemption and credit changes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exemption_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    matric_no TEXT NOT NULL,
    changed_by_staff_id TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_exemption_audit_student FOREIGN KEY (tenant_id, matric_no)
        REFERENCES students(tenant_id, matric_no) ON DELETE CASCADE
);

ALTER TABLE exemption_audit ENABLE ROW LEVEL SECURITY;

-- Advisor SELECT on own advisees only
CREATE POLICY "exemption_audit_advisor_select"
ON exemption_audit FOR SELECT
TO authenticated
USING (
    (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
);

-- No write policies for authenticated (inserts made through backend service role)

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (Do not run unless rolling back Migration 26)
-- =============================================================================
/*
BEGIN;

DROP TABLE IF EXISTS exemption_audit CASCADE;
DROP FUNCTION IF EXISTS clone_preset_to_tenant(TEXT, TEXT, DATE);
DROP TABLE IF EXISTS grade_scale_presets CASCADE;
DROP TABLE IF EXISTS grade_scales CASCADE;
DROP FUNCTION IF EXISTS my_tenant_id();

ALTER TABLE students DROP COLUMN IF EXISTS entry_semester;
ALTER TABLE tenants DROP COLUMN IF EXISTS repeat_policy;

-- Restore Migration 20 version of protect_student_identity_columns
CREATE OR REPLACE FUNCTION protect_student_identity_columns()
RETURNS TRIGGER AS $$
DECLARE
    jwt_claims TEXT;
    jwt_role TEXT;
BEGIN
    jwt_claims := current_setting('request.jwt.claims', true);

    IF jwt_claims IS NULL OR jwt_claims = '' THEN
        RETURN NEW;
    END IF;

    jwt_role := jwt_claims::json->>'role';

    IF jwt_role = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF (NEW.matric_no IS DISTINCT FROM OLD.matric_no) OR
       (NEW.advisor_staff_id IS DISTINCT FROM OLD.advisor_staff_id) OR
       (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) OR
       (NEW.user_id IS DISTINCT FROM OLD.user_id) OR
       (NEW.cgpa IS DISTINCT FROM OLD.cgpa) OR
       (NEW.academic_status IS DISTINCT FROM OLD.academic_status) OR
       (NEW.audit_status IS DISTINCT FROM OLD.audit_status) OR
       (NEW.graduation_credit_requirement IS DISTINCT FROM OLD.graduation_credit_requirement) OR
       (NEW.block_exempted_credits IS DISTINCT FROM OLD.block_exempted_credits) THEN
        RAISE EXCEPTION 'Restricted operation: modification of protected student columns (matric_no, advisor_staff_id, tenant_id, user_id, cgpa, academic_status, audit_status, graduation_credit_requirement, block_exempted_credits) is restricted to service_role or database administrators.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
*/
