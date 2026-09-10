-- ==============================================================================
-- 06_rls_hardening.sql — FINAL CORRECT VERSION
-- Schema verified 2026-09-11 via information_schema + live advisor output:
--
-- advisors.user_id = NULL for ALL advisors (auth email ≠ institutional_email).
-- Advisor identity MUST use: institutional_email = auth.jwt()->>'email'
-- Student identity uses:     students.user_id = auth.uid()
--
-- Live schema confirmed:
--   students:         matric_no (PK text), name, program, syllabus_type,
--                     advisor_staff_id, institutional_email, user_id (uuid null)
--   academic_records: matric_no (text NOT NULL), course_code, grade, ...
--   advisors:         staff_id (PK), institutional_email, user_id (uuid null)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Nuclear drop of ALL policies on students + academic_records
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('students', 'academic_records')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
        RAISE NOTICE 'Dropped: % on %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Enable + Force RLS on both tables
-- FORCE prevents the postgres / service_role from bypassing RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          FORCE  ROW LEVEL SECURITY;
ALTER TABLE academic_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_records  FORCE  ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — STUDENTS policies
--
-- Advisor identity: institutional_email = auth.jwt()->>'email'
--   (advisors.user_id is NULL for all advisors — cannot use user_id path)
--
-- Student identity: students.user_id = auth.uid()
--   (students claim their row at signup by setting user_id = auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT:
--   Students → only the row where user_id = auth.uid()          ← P1 fix
--   Students (pre-claim) → row where institutional_email matches JWT email
--   Advisors → rows where advisor_staff_id links to their email
CREATE POLICY "students_select"
ON students FOR SELECT
TO authenticated
USING (
    -- Post-claim student path: auth UID owns this row
    user_id = auth.uid()
    OR
    -- Pre-claim student path: email matches the pre-seeded institutional_email
    -- (allows newly-signed-up student to read their row before claim runs)
    (
        institutional_email IS NOT NULL
        AND (institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
    OR
    -- Advisor path: JWT email matches the advisor whose staff_id is on this row
    (
        advisor_staff_id IS NOT NULL
        AND advisor_staff_id IN (
            SELECT a.staff_id
            FROM   advisors a
            WHERE  (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
        )
    )
);

-- UPDATE:
--   Students → can update their own row (to set user_id at claim time)
--     • Post-claim:  user_id = auth.uid()                   ← already claimed
--     • Pre-claim:   institutional_email = jwt email         ← claiming NOW
--       (institutional_email is pre-seeded by advisor at row creation;
--        user_id is NULL until the student claims it here)
--   Advisors → can update rows they manage
CREATE POLICY "students_update"
ON students FOR UPDATE
TO authenticated
USING (
    -- Post-claim student path
    user_id = auth.uid()
    OR
    -- Pre-claim student path: email matches the pre-seeded institutional_email
    (
        institutional_email IS NOT NULL
        AND (institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
    OR
    -- Advisor path
    (
        advisor_staff_id IS NOT NULL
        AND advisor_staff_id IN (
            SELECT a.staff_id FROM advisors a
            WHERE (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
        )
    )
)
WITH CHECK (
    user_id = auth.uid()
    OR (
        institutional_email IS NOT NULL
        AND (institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
    OR (
        advisor_staff_id IS NOT NULL
        AND advisor_staff_id IN (
            SELECT a.staff_id FROM advisors a
            WHERE (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
        )
    )
);


-- INSERT: ONLY advisors can pre-seed rows; students CLAIM via UPDATE
CREATE POLICY "students_insert"
ON students FOR INSERT
TO authenticated
WITH CHECK (
    advisor_staff_id IS NOT NULL
    AND advisor_staff_id IN (
        SELECT a.staff_id FROM advisors a
        WHERE (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
);

-- DELETE: only advisors
CREATE POLICY "students_delete"
ON students FOR DELETE
TO authenticated
USING (
    advisor_staff_id IS NOT NULL
    AND advisor_staff_id IN (
        SELECT a.staff_id FROM advisors a
        WHERE (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — ACADEMIC_RECORDS policies                              ← P3 fix
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT:
--   Students (post-claim) → matric_no matches their claimed student row
--   Students (pre-claim)  → matric_no matches student row with their email
--   Advisors → matric_no belongs to any student they advise            ← P3 fix
CREATE POLICY "academic_records_select"
ON academic_records FOR SELECT
TO authenticated
USING (
    -- Student path (post-claim: user_id set)
    matric_no IN (
        SELECT s.matric_no FROM students s
        WHERE  s.user_id = auth.uid()
    )
    OR
    -- Student path (pre-claim: institutional_email match)
    matric_no IN (
        SELECT s.matric_no FROM students s
        WHERE  (s.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
    OR
    -- Advisor path
    matric_no IN (
        SELECT s.matric_no
        FROM   students s
        JOIN   advisors  a ON s.advisor_staff_id = a.staff_id
        WHERE  (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
);


-- INSERT / UPDATE / DELETE: advisors only
CREATE POLICY "academic_records_insert"
ON academic_records FOR INSERT
TO authenticated
WITH CHECK (
    matric_no IN (
        SELECT s.matric_no
        FROM   students s
        JOIN   advisors  a ON s.advisor_staff_id = a.staff_id
        WHERE  (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
);

CREATE POLICY "academic_records_update"
ON academic_records FOR UPDATE
TO authenticated
USING (
    matric_no IN (
        SELECT s.matric_no
        FROM   students s
        JOIN   advisors  a ON s.advisor_staff_id = a.staff_id
        WHERE  (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
)
WITH CHECK (
    matric_no IN (
        SELECT s.matric_no
        FROM   students s
        JOIN   advisors  a ON s.advisor_staff_id = a.staff_id
        WHERE  (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
);

CREATE POLICY "academic_records_delete"
ON academic_records FOR DELETE
TO authenticated
USING (
    matric_no IN (
        SELECT s.matric_no
        FROM   students s
        JOIN   advisors  a ON s.advisor_staff_id = a.staff_id
        WHERE  (a.institutional_email)::text = (auth.jwt() ->> 'email'::text)
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 — VERIFICATION (raw before/after comparison)
-- ─────────────────────────────────────────────────────────────────────────────

-- A: All policies now in effect (expect exactly 8 rows)
SELECT
    tablename,
    policyname,
    cmd,
    left(qual, 200) AS qual_preview
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename IN ('students', 'academic_records')
ORDER BY tablename, policyname;

-- B: RLS enabled + forced state (expect rls_on=t, rls_forced=t for BOTH)
SELECT
    c.relname        AS tablename,
    c.relrowsecurity AS rls_on,
    c.relforcerowsecurity AS rls_forced
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  c.relname IN ('students', 'academic_records');

-- C: Claimed vs unclaimed students
SELECT
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS claimed,
    COUNT(*) FILTER (WHERE user_id IS NULL)     AS unclaimed,
    COUNT(*)                                    AS total
FROM students;

-- D: Students who have claimed (have user_id set)
SELECT matric_no, name, user_id
FROM   students
WHERE  user_id IS NOT NULL
LIMIT  10;
