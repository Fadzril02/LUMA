-- ==============================================================================
-- STEP 1: DIAGNOSE — Run this first to see what policies currently exist
-- ==============================================================================
SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles::text as roles, 
    cmd, 
    left(qual, 100) as qual_short
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('students', 'academic_records')
ORDER BY tablename, policyname;

-- ==============================================================================
-- STEP 2: NUCLEAR DROP — Drop ALL existing policies on students and academic_records
-- This uses dynamic SQL to wipe every policy regardless of name
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('students', 'academic_records')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- ==============================================================================
-- STEP 3: Ensure RLS is enabled (in case it got disabled)
-- ==============================================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_records ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- STEP 4: Create the correct, scoped policies
-- ==============================================================================

-- STUDENTS: Students can only see their own row
CREATE POLICY "students_own_row_select"
ON students FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email')
    )
);

-- STUDENTS: Students can only update their own row
CREATE POLICY "students_own_row_update"
ON students FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- STUDENTS: Advisors can pre-seed new student rows
CREATE POLICY "students_advisor_insert"
ON students FOR INSERT
TO authenticated
WITH CHECK (
    advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email')
    )
);

-- STUDENTS: Advisors can delete students they advise
CREATE POLICY "students_advisor_delete"
ON students FOR DELETE
TO authenticated
USING (
    advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email')
    )
);

-- ACADEMIC_RECORDS: Students see own records; advisors see their students' records
CREATE POLICY "academic_records_own_select"
ON academic_records FOR SELECT
TO authenticated
USING (
    matric_no IN (
        SELECT matric_no FROM students WHERE user_id = auth.uid()
    )
    OR
    matric_no IN (
        SELECT s.matric_no FROM students s
        JOIN advisors a ON s.advisor_staff_id = a.staff_id
        WHERE a.institutional_email = (auth.jwt() ->> 'email')
    )
);

-- ==============================================================================
-- STEP 5: VERIFY — Check what policies now exist after the fix
-- ==============================================================================
SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles::text as roles, 
    cmd, 
    left(qual, 120) as qual_short
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('students', 'academic_records')
ORDER BY tablename, policyname;
