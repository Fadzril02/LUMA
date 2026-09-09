-- ==============================================================================
-- Migration: Student Auth RLS & Security Hardening
-- Version: 05_student_auth_rls.sql
-- Applies to the LIVE schema (matric_no-based, not UUID-based)
-- ==============================================================================

-- ==============================================================================
-- PRIORITY 1: Add user_id to students table and fix RLS
-- ==============================================================================

-- Step 1: Add user_id column (nullable initially, will be set at claim time)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);

-- Step 2: Drop all existing student SELECT policies that expose all rows
DROP POLICY IF EXISTS "Students can view their own profile" ON students;
DROP POLICY IF EXISTS "Students and Advisors can update student profiles" ON students;
DROP POLICY IF EXISTS "Students can self-register their profile" ON students;
DROP POLICY IF EXISTS "Advisors can delete students in their cohorts" ON students;
-- Drop the old advisor-only policies too (from 02_rls_policies.sql) in case they exist
DROP POLICY IF EXISTS "Advisors can view their assigned students" ON students;
DROP POLICY IF EXISTS "Advisors can insert students" ON students;
DROP POLICY IF EXISTS "Advisors can update their assigned students" ON students;
DROP POLICY IF EXISTS "Advisors can delete their assigned students" ON students;

-- Step 3: Students can ONLY see their own row (user_id = auth.uid())
CREATE POLICY "Students can view only their own row"
ON students FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    -- Advisors can see all students they advise
    advisor_staff_id IN (
        SELECT staff_id FROM advisors WHERE institutional_email = auth.jwt() ->> 'email'
    )
);

-- Step 4: Students can UPDATE only their own row (to allow profile edits)
CREATE POLICY "Students can update only their own row"
ON students FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 5: Advisors can INSERT new pre-seeded student rows (but NOT students themselves)
-- Students CANNOT insert new rows — only CLAIM existing ones via UPDATE
CREATE POLICY "Only advisors can pre-seed student rows"
ON students FOR INSERT
TO authenticated
WITH CHECK (
    advisor_staff_id IN (
        SELECT staff_id FROM advisors WHERE institutional_email = auth.jwt() ->> 'email'
    )
);

-- ==============================================================================
-- PRIORITY 3: Add student-facing SELECT policy on academic_records
-- ==============================================================================

-- Drop old advisor-only policies
DROP POLICY IF EXISTS "Users view academic records of accessible students" ON academic_records;
DROP POLICY IF EXISTS "Advisors can view academic records for their students" ON academic_records;

-- Students can read their own academic records (via user_id link through students table)
CREATE POLICY "Students can view their own academic records"
ON academic_records FOR SELECT
TO authenticated
USING (
    matric_no IN (
        SELECT matric_no FROM students WHERE user_id = auth.uid()
    )
    OR
    -- Advisors can view records of their students
    matric_no IN (
        SELECT matric_no FROM students
        WHERE advisor_staff_id IN (
            SELECT staff_id FROM advisors WHERE institutional_email = auth.jwt() ->> 'email'
        )
    )
);
