-- ==============================================================================
-- [PROJECT_NAME] Database Schema Migration
-- Company: [COMPANY_NAME]
-- Description: Multi-tenant schema for academic advisors degree audit platform
-- Version: 01_schema.sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. Storage Buckets Setup
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'transcripts',
    'transcripts',
    false,
    15728640, -- 15MB limit
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ==============================================================================
-- 2. Universities (Master Tenant)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'UTM', 'UM', 'USM'
    grading_scale JSONB NOT NULL DEFAULT '{
        "A+": 4.00, "A": 4.00, "A-": 3.67,
        "B+": 3.33, "B": 3.00, "B-": 2.67,
        "C+": 2.33, "C": 2.00, "C-": 1.67,
        "D+": 1.33, "D": 1.00, "E": 0.00,
        "HL": 0.00, "TD": 0.00, "TS": 0.00, "TL": 0.00
    }'::jsonb,
    min_cgpa_good_standing NUMERIC(3, 2) NOT NULL DEFAULT 2.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. Advisors (Academic Staff tied to Supabase Auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS advisors (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
    staff_id VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(150),
    tier VARCHAR(50) NOT NULL DEFAULT 'freemium' CHECK (tier IN ('freemium', 'pro', 'department', 'enterprise')),
    monthly_audit_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(university_id, staff_id)
);

-- ==============================================================================
-- 4. Students
-- ==============================================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advisor_id UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
    matric_number VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    curriculum_year VARCHAR(20) NOT NULL, -- e.g., '2023/2024'
    program_code VARCHAR(50) NOT NULL,    -- e.g., 'SECJ' (Software Engineering)
    cgpa NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    total_credits_earned INT NOT NULL DEFAULT 0,
    academic_status VARCHAR(50) NOT NULL DEFAULT 'Good Standing' CHECK (academic_status IN ('Good Standing', 'At-Risk', 'Probation', 'Suspension', 'Graduated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(university_id, matric_number)
);

-- ==============================================================================
-- 5. Courses & Prerequisite Definitions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- e.g., 'SECJ1013'
    name VARCHAR(255) NOT NULL,
    credits INT NOT NULL DEFAULT 3,
    category VARCHAR(100) NOT NULL DEFAULT 'Core', -- Core, Elective, University Requirement
    -- Prerequisites JSONB structure:
    -- { "type": "AND|OR", "courses": ["SECJ1013"], "min_grade": "C", "min_credits": 0 }
    prerequisites JSONB NOT NULL DEFAULT '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(university_id, code)
);

-- ==============================================================================
-- 6. Academic Records (Parsed Transcript Line Items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS academic_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255),
    credits INT NOT NULL DEFAULT 3,
    grade VARCHAR(10) NOT NULL,
    grade_point NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    semester VARCHAR(50) NOT NULL, -- e.g., 'Sem 1 2023/2024'
    status VARCHAR(50) NOT NULL CHECK (status IN ('Passed', 'Failed', 'Exempted', 'In-Progress')),
    prerequisite_met BOOLEAN NOT NULL DEFAULT TRUE,
    missing_prerequisites TEXT[] NOT NULL DEFAULT '{}',
    -- Zero-Waste AI Audit Trail Tracking
    is_ai_parsed BOOLEAN NOT NULL DEFAULT FALSE,
    raw_extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. Degree Audits (Historical Snapshot of Full Audit Executions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS degree_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    advisor_id UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
    audit_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (audit_status IN ('COMPLETED', 'NEEDS_REVIEW', 'FAILED')),
    total_credits_required INT NOT NULL DEFAULT 130,
    total_credits_earned INT NOT NULL DEFAULT 0,
    traffic_light_status VARCHAR(20) NOT NULL DEFAULT 'GREEN' CHECK (traffic_light_status IN ('GREEN', 'YELLOW', 'RED')),
    unmet_prerequisites_count INT NOT NULL DEFAULT 0,
    failed_courses_count INT NOT NULL DEFAULT 0,
    -- Full snapshot of traffic-light audit matrix & graph status
    audit_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    storage_pdf_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_advisors_university ON advisors(university_id);
CREATE INDEX IF NOT EXISTS idx_students_advisor ON students(advisor_id);
CREATE INDEX IF NOT EXISTS idx_students_matric ON students(matric_number);
CREATE INDEX IF NOT EXISTS idx_courses_uni_code ON courses(university_id, code);
CREATE INDEX IF NOT EXISTS idx_academic_records_student ON academic_records(student_id);
CREATE INDEX IF NOT EXISTS idx_degree_audits_student ON degree_audits(student_id);
CREATE INDEX IF NOT EXISTS idx_degree_audits_advisor ON degree_audits(advisor_id);
