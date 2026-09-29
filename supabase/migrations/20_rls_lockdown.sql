BEGIN;

-- =============================================================================
-- Migration: 20_rls_lockdown.sql
-- Description: Strict RLS lockdown enforcing server-side identity (user_id = auth.uid()).
--
-- 1. Pre-check: Abort if any advisors or students rows have NULL user_id.
-- 2. Schema constraints: Enforce tenant_id NOT NULL on students and advisors.
--    Enforce UNIQUE (tenant_id, matric_no) on students.
-- 3. Drop legacy & duplicate client-facing policies.
-- 4. SECURITY DEFINER helper functions to prevent RLS recursion:
--    - my_staff_ids()
--    - my_advisor_staff_ids()
--    - my_matric_nos()
--    - my_advisee_matric_nos()
-- 5. Rewrite policies:
--    - advisors: SELECT (own OR student viewing assigned advisor), UPDATE (own)
--    - students: SELECT (own OR advisee), UPDATE (assigned advisor only)
--    - academic_records: SELECT (own matric OR advisee), INSERT/UPDATE (advisee only)
--    - No INSERT on advisors/students; No DELETE on advisors/students/academic_records
-- 6. Trigger guards: Prevent mutation of identity/audit columns except by
--    service_role or direct DB/SQL editor (NULL / empty jwt claims).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: SAFETY PRE-CHECK
-- Abort if any student or advisor row is orphaned without user_id
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    orphan_adv RECORD;
    orphan_stu RECORD;
BEGIN
    SELECT staff_id, institutional_email INTO orphan_adv 
    FROM advisors 
    WHERE user_id IS NULL 
    LIMIT 1;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Cannot proceed with RLS lockdown: advisor (staff_id: %, email: %) has NULL user_id', 
            orphan_adv.staff_id, orphan_adv.institutional_email;
    END IF;

    SELECT matric_no, institutional_email INTO orphan_stu 
    FROM students 
    WHERE user_id IS NULL 
    LIMIT 1;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Cannot proceed with RLS lockdown: student (matric_no: %, email: %) has NULL user_id', 
            orphan_stu.matric_no, orphan_stu.institutional_email;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 2: SCHEMA CONSTRAINTS
-- -----------------------------------------------------------------------------
ALTER TABLE students ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE advisors ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_students_tenant_matric'
    ) THEN
        ALTER TABLE students ADD CONSTRAINT uq_students_tenant_matric UNIQUE (tenant_id, matric_no);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 3: DROP INSECURE, DEPRECATED & DUPLICATE POLICIES
-- -----------------------------------------------------------------------------

-- Drop advisors policies
DROP POLICY IF EXISTS "Anyone can read advisors for code validation" ON advisors;
DROP POLICY IF EXISTS "Allow frontend advisor registration" ON advisors;
DROP POLICY IF EXISTS "advisors_self_insert" ON advisors;
DROP POLICY IF EXISTS "Advisors can view their own profile" ON advisors;
DROP POLICY IF EXISTS "Advisors can update their own profile" ON advisors;
DROP POLICY IF EXISTS "Advisors can insert their initial profile" ON advisors;
DROP POLICY IF EXISTS "advisors_select" ON advisors;
DROP POLICY IF EXISTS "advisors_update" ON advisors;

-- Drop students policies
DROP POLICY IF EXISTS "Allow frontend student registration" ON students;
DROP POLICY IF EXISTS "students_insert_self" ON students;
DROP POLICY IF EXISTS "Students can self-register their profile" ON students;
DROP POLICY IF EXISTS "Students can view their own profile" ON students;
DROP POLICY IF EXISTS "Students can view only their own row" ON students;
DROP POLICY IF EXISTS "students_own_row_select" ON students;
DROP POLICY IF EXISTS "students_select" ON students;
DROP POLICY IF EXISTS "students_update" ON students;
DROP POLICY IF EXISTS "students_insert" ON students;
DROP POLICY IF EXISTS "students_delete" ON students;
DROP POLICY IF EXISTS "Students and Advisors can update student profiles" ON students;
DROP POLICY IF EXISTS "Advisors can delete students in their cohorts" ON students;
DROP POLICY IF EXISTS "Advisors can view their assigned students" ON students;
DROP POLICY IF EXISTS "Advisors can insert students" ON students;
DROP POLICY IF EXISTS "Advisors can update their assigned students" ON students;
DROP POLICY IF EXISTS "Advisors can delete their assigned students" ON students;
DROP POLICY IF EXISTS "students_own_row_update" ON students;
DROP POLICY IF EXISTS "students_advisor_insert" ON students;
DROP POLICY IF EXISTS "students_advisor_delete" ON students;

-- Drop academic_records policies
DROP POLICY IF EXISTS "academic_records_select" ON academic_records;
DROP POLICY IF EXISTS "academic_records_insert" ON academic_records;
DROP POLICY IF EXISTS "academic_records_update" ON academic_records;
DROP POLICY IF EXISTS "academic_records_delete" ON academic_records;
DROP POLICY IF EXISTS "Users view academic records of accessible students" ON academic_records;
DROP POLICY IF EXISTS "Users insert academic records for accessible students" ON academic_records;
DROP POLICY IF EXISTS "Users update academic records for accessible students" ON academic_records;
DROP POLICY IF EXISTS "Students can view their own academic records" ON academic_records;
DROP POLICY IF EXISTS "academic_records_own_select" ON academic_records;
DROP POLICY IF EXISTS "Advisors can view academic records for their students" ON academic_records;
DROP POLICY IF EXISTS "Advisors can insert academic records for their students" ON academic_records;

-- Drop duplicate course SELECT policies
DROP POLICY IF EXISTS "Allow public select on course" ON course;
DROP POLICY IF EXISTS "Advisors can view courses for their university" ON course;

-- -----------------------------------------------------------------------------
-- STEP 4: SECURITY DEFINER FUNCTIONS (NO RLS RECURSION)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION my_staff_ids()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT staff_id::text FROM advisors WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION my_advisor_staff_ids()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT advisor_staff_id::text FROM students WHERE user_id = auth.uid();
$$;

DROP FUNCTION IF EXISTS my_matric_nos();
CREATE OR REPLACE FUNCTION my_matric_nos()
RETURNS TABLE(tenant_id TEXT, matric_no TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.tenant_id::text, s.matric_no::text 
    FROM students s 
    WHERE s.user_id = auth.uid();
$$;

DROP FUNCTION IF EXISTS my_advisee_matric_nos();
CREATE OR REPLACE FUNCTION my_advisee_matric_nos()
RETURNS TABLE(tenant_id TEXT, matric_no TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.tenant_id::text, s.matric_no::text 
    FROM students s
    JOIN advisors a ON s.advisor_staff_id = a.staff_id AND s.tenant_id = a.tenant_id
    WHERE a.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION my_staff_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_staff_ids() TO authenticated;

REVOKE ALL ON FUNCTION my_advisor_staff_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_advisor_staff_ids() TO authenticated;

REVOKE ALL ON FUNCTION my_matric_nos() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_matric_nos() TO authenticated;

REVOKE ALL ON FUNCTION my_advisee_matric_nos() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_advisee_matric_nos() TO authenticated;

-- -----------------------------------------------------------------------------
-- STEP 5: REWRITE RLS POLICIES (EXCLUSIVELY VIA SECURITY DEFINER HELPERS)
-- -----------------------------------------------------------------------------

-- 5a. Advisors Policies
-- SELECT: Own row OR student viewing their assigned advisor
CREATE POLICY "advisors_select"
ON advisors FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR staff_id IN (SELECT my_advisor_staff_ids())
);

-- UPDATE: Own row only
CREATE POLICY "advisors_update"
ON advisors FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- NO INSERT or DELETE policies on advisors (service_role only)

-- 5b. Students Policies
-- SELECT: Own record OR assigned advisor viewing advisee
CREATE POLICY "students_select"
ON students FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR advisor_staff_id IN (SELECT my_staff_ids())
);

-- UPDATE: Advisor of that student only (no student branch)
CREATE POLICY "students_update"
ON students FOR UPDATE
TO authenticated
USING (
    advisor_staff_id IN (SELECT my_staff_ids())
)
WITH CHECK (
    advisor_staff_id IN (SELECT my_staff_ids())
);

-- NO INSERT or DELETE policies on students (service_role only)

-- 5c. Academic Records Policies
-- SELECT: Own matric OR assigned advisor viewing advisee
CREATE POLICY "academic_records_select"
ON academic_records FOR SELECT
TO authenticated
USING (
    (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_matric_nos())
    OR (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
);

-- INSERT: Advisees only (advisor)
CREATE POLICY "academic_records_insert"
ON academic_records FOR INSERT
TO authenticated
WITH CHECK (
    (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
);

-- UPDATE: Advisees only (advisor)
CREATE POLICY "academic_records_update"
ON academic_records FOR UPDATE
TO authenticated
USING (
    (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
)
WITH CHECK (
    (tenant_id, matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
);

-- NO DELETE policy on academic_records

-- -----------------------------------------------------------------------------
-- STEP 6: IDENTITY & AUDIT COLUMN IMMUTABILITY TRIGGERS
-- Bypassed if:
--   - Direct DB / SQL Editor: current_setting('request.jwt.claims', true) IS NULL OR ''
--   - Backend Service Role: role = 'service_role'
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

    -- Block modification of protected student columns
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

DROP TRIGGER IF EXISTS trg_protect_student_identity ON students;
CREATE TRIGGER trg_protect_student_identity
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION protect_student_identity_columns();

CREATE OR REPLACE FUNCTION protect_advisor_identity_columns()
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

    -- Block modification of protected advisor columns
    IF (NEW.staff_id IS DISTINCT FROM OLD.staff_id) OR
       (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) OR
       (NEW.is_founding_advisor IS DISTINCT FROM OLD.is_founding_advisor) OR
       (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        RAISE EXCEPTION 'Restricted operation: modification of protected advisor columns (staff_id, tenant_id, is_founding_advisor, user_id) is restricted to service_role or database administrators.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_advisor_identity ON advisors;
CREATE TRIGGER trg_protect_advisor_identity
BEFORE UPDATE ON advisors
FOR EACH ROW
EXECUTE FUNCTION protect_advisor_identity_columns();

COMMIT;

/*
-- =============================================================================
-- VERIFICATION TEST QUERIES (Run manually in Supabase SQL Editor after applying)
-- =============================================================================

-- 1. Count of active policies per table (expected: advisors=2, students=2, academic_records=3)
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('advisors', 'students', 'academic_records')
GROUP BY tablename
ORDER BY tablename;

-- 2. Inspect all active policies and their exact definitions
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('advisors', 'students', 'academic_records')
ORDER BY tablename, cmd, policyname;

-- =============================================================================
-- ROLLBACK SCRIPT (Reverts lockdown and restores legacy policies)
-- =============================================================================
BEGIN;

-- 1. Drop identity protection triggers & functions
DROP TRIGGER IF EXISTS trg_protect_student_identity ON students;
DROP FUNCTION IF EXISTS protect_student_identity_columns();
DROP TRIGGER IF EXISTS trg_protect_advisor_identity ON advisors;
DROP FUNCTION IF EXISTS protect_advisor_identity_columns();

-- 2. Drop unique constraint and revert NOT NULL on tenant_id
ALTER TABLE students DROP CONSTRAINT IF EXISTS uq_students_tenant_matric;
ALTER TABLE students ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE advisors ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Drop rewritten policies
DROP POLICY IF EXISTS "advisors_select" ON advisors;
DROP POLICY IF EXISTS "advisors_update" ON advisors;
DROP POLICY IF EXISTS "students_select" ON students;
DROP POLICY IF EXISTS "students_update" ON students;
DROP POLICY IF EXISTS "academic_records_select" ON academic_records;
DROP POLICY IF EXISTS "academic_records_insert" ON academic_records;
DROP POLICY IF EXISTS "academic_records_update" ON academic_records;

-- 4. Drop SECURITY DEFINER helper functions
DROP FUNCTION IF EXISTS my_advisee_matric_nos();
DROP FUNCTION IF EXISTS my_matric_nos();
DROP FUNCTION IF EXISTS my_advisor_staff_ids();
DROP FUNCTION IF EXISTS my_staff_ids();

-- 5. Recreate legacy dropped policies
CREATE POLICY "Anyone can read advisors for code validation"
ON advisors FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow frontend advisor registration"
ON advisors FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "advisors_self_insert"
ON advisors FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Advisors can update their own profile"
ON advisors FOR UPDATE
TO authenticated
USING (
    institutional_email = (auth.jwt() ->> 'email')
    OR user_id = auth.uid()
);

CREATE POLICY "Allow frontend student registration"
ON students FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "students_insert_self"
ON students FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "students_select"
ON students FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR institutional_email = (auth.jwt() ->> 'email')
    OR advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email')
           OR user_id = auth.uid()
    )
);

CREATE POLICY "students_update"
ON students FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    OR institutional_email = (auth.jwt() ->> 'email')
    OR advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email')
           OR user_id = auth.uid()
    )
);

CREATE POLICY "academic_records_select"
ON academic_records FOR SELECT
TO authenticated
USING (
    matric_no IN (
        SELECT matric_no FROM students 
        WHERE user_id = auth.uid()
           OR institutional_email = (auth.jwt() ->> 'email')
    )
    OR matric_no IN (
        SELECT s.matric_no FROM students s
        JOIN advisors a ON s.advisor_staff_id = a.staff_id
        WHERE a.user_id = auth.uid()
           OR a.institutional_email = (auth.jwt() ->> 'email')
    )
);

CREATE POLICY "Allow public select on course"
ON course FOR SELECT
TO anon, authenticated
USING (true);

COMMIT;
*/
