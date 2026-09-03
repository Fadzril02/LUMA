-- ==============================================================================
-- [PROJECT_NAME] Migration: Self-Serve SaaS & Cohort Invite Architecture
-- Company: [COMPANY_NAME]
-- Description: Product-Led Growth (PLG) self-registration for students,
--              cohort invite codes, and updated multi-tenant RLS policies
-- Version: 04_self_serve_pivot.sql
-- ==============================================================================

-- ==============================================================================
-- 1. Cohorts Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advisor_id UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL, -- e.g., "Software Engineering 2025 Intake"
    invite_code VARCHAR(6) UNIQUE NOT NULL, -- e.g., "SE25X9"
    curriculum_version VARCHAR(50) NOT NULL DEFAULT '2023/2024',
    max_students INT DEFAULT 200,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for instant invite code lookup
CREATE INDEX IF NOT EXISTS idx_cohorts_invite_code ON cohorts(invite_code);
CREATE INDEX IF NOT EXISTS idx_cohorts_advisor ON cohorts(advisor_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_university ON cohorts(university_id);

-- ==============================================================================
-- 2. Update Students Table for Self-Registration
-- ==============================================================================
DO $$ 
BEGIN
    -- Add cohort_id foreign key if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'cohort_id'
    ) THEN
        ALTER TABLE students ADD COLUMN cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;
    END IF;

    -- Add user_id foreign key to auth.users for student login
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE students ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_cohort ON students(cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);

-- ==============================================================================
-- 3. Enable RLS on Cohorts Table
-- ==============================================================================
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. Cohorts RLS Policies
-- ==============================================================================
-- Advisors can manage (CRUD) their own cohorts
CREATE POLICY "Advisors manage their own cohorts"
ON cohorts FOR ALL
TO authenticated
USING (advisor_id = auth.uid())
WITH CHECK (advisor_id = auth.uid());

-- Any authenticated user (including students) can lookup active cohorts by invite code
CREATE POLICY "Users can view active cohorts for joining"
ON cohorts FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- ==============================================================================
-- 5. Updated Students RLS Policies (Self-Serve & Advisor Access)
-- ==============================================================================
-- Drop existing student policies to apply the unified self-serve policies
DROP POLICY IF EXISTS "Advisors can view their assigned students" ON students;
DROP POLICY IF EXISTS "Advisors can insert students" ON students;
DROP POLICY IF EXISTS "Advisors can update their assigned students" ON students;
DROP POLICY IF EXISTS "Advisors can delete their assigned students" ON students;

-- Policy A: Students can view and manage their own profile
CREATE POLICY "Students can view their own profile"
ON students FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    advisor_id = auth.uid() OR
    cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
);

CREATE POLICY "Students can self-register their profile"
ON students FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid() OR
    advisor_id = auth.uid()
);

CREATE POLICY "Students and Advisors can update student profiles"
ON students FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid() OR
    advisor_id = auth.uid() OR
    cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
)
WITH CHECK (
    user_id = auth.uid() OR
    advisor_id = auth.uid() OR
    cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
);

CREATE POLICY "Advisors can delete students in their cohorts"
ON students FOR DELETE
TO authenticated
USING (
    advisor_id = auth.uid() OR
    cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
);

-- ==============================================================================
-- 6. Updated Academic Records & Audits RLS for Self-Serve Students
-- ==============================================================================
DROP POLICY IF EXISTS "Advisors can view academic records for their students" ON academic_records;
DROP POLICY IF EXISTS "Advisors can insert academic records for their students" ON academic_records;
DROP POLICY IF EXISTS "Advisors can update academic records for their students" ON academic_records;
DROP POLICY IF EXISTS "Advisors can delete academic records for their students" ON academic_records;

CREATE POLICY "Users view academic records of accessible students"
ON academic_records FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM students 
        WHERE user_id = auth.uid() 
           OR advisor_id = auth.uid() 
           OR cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
    )
);

CREATE POLICY "Users insert academic records for accessible students"
ON academic_records FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM students 
        WHERE user_id = auth.uid() 
           OR advisor_id = auth.uid() 
           OR cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
    )
);

CREATE POLICY "Users update academic records for accessible students"
ON academic_records FOR UPDATE
TO authenticated
USING (
    student_id IN (
        SELECT id FROM students 
        WHERE user_id = auth.uid() 
           OR advisor_id = auth.uid() 
           OR cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
    )
)
WITH CHECK (
    student_id IN (
        SELECT id FROM students 
        WHERE user_id = auth.uid() 
           OR advisor_id = auth.uid() 
           OR cohort_id IN (SELECT id FROM cohorts WHERE advisor_id = auth.uid())
    )
);

-- Update Degree Audits RLS
DROP POLICY IF EXISTS "Advisors can view degree audits for their students" ON degree_audits;

CREATE POLICY "Users view degree audits for accessible students"
ON degree_audits FOR SELECT
TO authenticated
USING (
    advisor_id = auth.uid() OR
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
