-- ==============================================================================
-- Migration: Loose Admission Safety Net & Registration Disputes
-- Version: 09_loose_admission_safety_net.sql
-- Description:
--   1. Creates registration_disputes table for contested matric registrations.
--   2. Sets up Row Level Security (RLS) allowing anonymous and authenticated
--      students to submit disputes, while restricting read/update to advisors.
--   3. Enforces multi-tenant matric number format constraint on students table.
-- ==============================================================================

-- 1. Create the Registration Disputes Table
CREATE TABLE IF NOT EXISTS registration_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matric_no VARCHAR(20) NOT NULL,
    disputed_by_email VARCHAR(255) NOT NULL,
    advisor_staff_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient lookup by advisor surveillance and matric tracking
CREATE INDEX IF NOT EXISTS idx_registration_disputes_matric ON registration_disputes(matric_no);
CREATE INDEX IF NOT EXISTS idx_registration_disputes_advisor ON registration_disputes(advisor_staff_id);
CREATE INDEX IF NOT EXISTS idx_registration_disputes_status ON registration_disputes(status);

-- 2. Row Level Security (RLS)
ALTER TABLE registration_disputes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to submit a dispute
DROP POLICY IF EXISTS "Anyone can insert registration disputes" ON registration_disputes;
CREATE POLICY "Anyone can insert registration disputes"
ON registration_disputes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow advisors to view and manage disputes associated with their staff ID
DROP POLICY IF EXISTS "Advisors can view their cohort disputes" ON registration_disputes;
DROP POLICY IF EXISTS "Advisors can update their cohort disputes" ON registration_disputes;
DROP POLICY IF EXISTS "Advisors manage disputes" ON registration_disputes;

CREATE POLICY "Advisors manage disputes"
ON registration_disputes FOR ALL
TO authenticated
USING (
    advisor_staff_id = (SELECT staff_id FROM advisors WHERE user_id = auth.uid())
)
WITH CHECK (
    advisor_staff_id = (SELECT staff_id FROM advisors WHERE user_id = auth.uid())
);

-- 3. Multi-Tenant Matric Number Constraint on Students Table
ALTER TABLE students DROP CONSTRAINT IF EXISTS check_students_matric_no_format;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_matric_no_check;
ALTER TABLE students ADD CONSTRAINT students_matric_no_check CHECK (matric_no ~* '^[A-Z0-9]{5,15}$');
