-- ==============================================================================
-- Migration: Multi-Tenant Blueprint Architecture & Cohort Gatekeeper
-- Version: 08_multi_tenant_blueprint_architecture.sql
-- Description:
--   1. Creates degree_templates and template_courses (the degree blueprints).
--   2. Recreates cohorts table tied to degree_templates and advisors.
--   3. Updates students table with cohort_id foreign key.
--   4. Drops legacy registration_code and is_registration_locked from advisors.
--   5. Configures strict Row Level Security (RLS) policies.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create the Blueprint Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Degree Templates (University Program Blueprints)
CREATE TABLE IF NOT EXISTS degree_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_name VARCHAR(255) NOT NULL DEFAULT 'Universiti Teknologi Malaysia',
    program_code VARCHAR(50) NOT NULL, -- e.g., 'SECJ'
    program_name VARCHAR(255) NOT NULL, -- e.g., 'Software Engineering'
    syllabus_year VARCHAR(50) NOT NULL, -- e.g., '2024/2025'
    total_credits_required INT NOT NULL DEFAULT 130,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_degree_templates_univ_prog_year UNIQUE (university_name, program_code, syllabus_year)
);

CREATE INDEX IF NOT EXISTS idx_degree_templates_lookup 
ON degree_templates(university_name, program_code, syllabus_year);

-- 1b. Template Courses (Curriculum Syllabus per Blueprint)
CREATE TABLE IF NOT EXISTS template_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES degree_templates(id) ON DELETE CASCADE,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    credit_hour INT NOT NULL DEFAULT 3,
    is_core_requirement BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_template_courses_template_course UNIQUE (template_id, course_code)
);

CREATE INDEX IF NOT EXISTS idx_template_courses_template_id ON template_courses(template_id);
CREATE INDEX IF NOT EXISTS idx_template_courses_course_code ON template_courses(course_code);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Create the Cohorts Table (The Tinkercad Gatekeeper)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function to generate persistent 6-character cohort codes ('ABC-123')
CREATE OR REPLACE FUNCTION generate_cohort_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..3 LOOP
        result := result || SUBSTRING(chars FROM floor(random() * length(chars) + 1)::int FOR 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..3 LOOP
        result := result || SUBSTRING(chars FROM floor(random() * length(chars) + 1)::int FOR 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Drop obsolete prototype cohorts table if exists
DROP TABLE IF EXISTS cohorts CASCADE;

CREATE TABLE cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_staff_id VARCHAR(50) NOT NULL REFERENCES advisors(staff_id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES degree_templates(id) ON DELETE RESTRICT,
    cohort_name VARCHAR(255) NOT NULL,
    cohort_code VARCHAR(8) UNIQUE NOT NULL DEFAULT generate_cohort_code(),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_advisor ON cohorts(advisor_staff_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_code ON cohorts(cohort_code);
CREATE INDEX IF NOT EXISTS idx_cohorts_template ON cohorts(template_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Update the Students Table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE students
ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON students(cohort_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Seed Default Blueprint & Preserve Existing Advisor Codes
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    default_tmpl_id UUID;
    adv RECORD;
BEGIN
    -- Seed initial UTM SECJ 2024/2025 degree template
    INSERT INTO degree_templates (university_name, program_code, program_name, syllabus_year, total_credits_required)
    VALUES ('Universiti Teknologi Malaysia', 'SECJ', 'Software Engineering', '2024/2025', 130)
    ON CONFLICT (university_name, program_code, syllabus_year)
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO default_tmpl_id;

    IF default_tmpl_id IS NULL THEN
        SELECT id INTO default_tmpl_id FROM degree_templates 
        WHERE university_name = 'Universiti Teknologi Malaysia' AND program_code = 'SECJ' AND syllabus_year = '2024/2025'
        LIMIT 1;
    END IF;

    -- Seed foundational core syllabus courses for SECJ 2024/2025
    INSERT INTO template_courses (template_id, course_code, course_name, credit_hour, is_core_requirement)
    VALUES 
        (default_tmpl_id, 'SECJ1013', 'Programming Technique I', 3, true),
        (default_tmpl_id, 'SECJ1023', 'Programming Technique II', 3, true),
        (default_tmpl_id, 'SECJ2013', 'Data Structures and Algorithms', 3, true),
        (default_tmpl_id, 'SECJ2154', 'Object-Oriented Programming', 4, true),
        (default_tmpl_id, 'SECJ2203', 'Software Engineering', 3, true),
        (default_tmpl_id, 'SECP2243', 'Software Engineering Project I', 3, true)
    ON CONFLICT (template_id, course_code) DO NOTHING;

    -- If advisors table has legacy registration_code, migrate existing advisors into cohorts
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'advisors' AND column_name = 'registration_code'
    ) THEN
        FOR adv IN SELECT staff_id, registration_code, is_registration_locked FROM advisors WHERE registration_code IS NOT NULL LOOP
            INSERT INTO cohorts (advisor_staff_id, template_id, cohort_name, cohort_code, is_locked)
            VALUES (
                adv.staff_id,
                default_tmpl_id,
                'SECJ 2024 - ' || adv.staff_id,
                adv.registration_code,
                COALESCE(adv.is_registration_locked, false)
            )
            ON CONFLICT (cohort_code) DO UPDATE 
            SET is_locked = EXCLUDED.is_locked;
        END LOOP;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Clean Up Legacy Columns on advisors
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE advisors
DROP COLUMN IF EXISTS registration_code,
DROP COLUMN IF EXISTS is_registration_locked;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Row Level Security (RLS) Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. degree_templates: SELECT for authenticated and public
ALTER TABLE degree_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and authenticated can read degree_templates" ON degree_templates;
CREATE POLICY "Public and authenticated can read degree_templates"
ON degree_templates FOR SELECT
TO anon, authenticated
USING (true);

-- 6b. template_courses: SELECT for authenticated and public
ALTER TABLE template_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and authenticated can read template_courses" ON template_courses;
CREATE POLICY "Public and authenticated can read template_courses"
ON template_courses FOR SELECT
TO anon, authenticated
USING (true);

-- 6c. cohorts:
-- Advisors can ALL on their own cohorts (matching advisor_staff_id)
-- Public can SELECT where is_locked = false (for signup validation)
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advisors can manage their own cohorts" ON cohorts;
CREATE POLICY "Advisors can manage their own cohorts"
ON cohorts FOR ALL
TO authenticated
USING (
    advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email') 
           OR user_id = auth.uid()
    )
)
WITH CHECK (
    advisor_staff_id IN (
        SELECT staff_id FROM advisors 
        WHERE institutional_email = (auth.jwt() ->> 'email') 
           OR user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Public can view active unlocked cohorts" ON cohorts;
CREATE POLICY "Public can view active unlocked cohorts"
ON cohorts FOR SELECT
TO anon, authenticated
USING (is_locked = false);
