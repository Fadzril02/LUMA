-- ==============================================================================
-- Migration: Persistent, Resettable Advisor Registration Codes ("Tinkercad Model")
-- Version: 07_advisor_registration_codes.sql
-- Description:
--   1. Adds persistent registration_code and is_registration_locked columns directly to advisors.
--   2. Generates formatted 6-character codes (e.g. 'ABC-123') for all existing advisors.
--   3. Configures RLS policies for student validation and advisor self-management.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Add new columns to advisors table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE advisors 
ADD COLUMN IF NOT EXISTS registration_code VARCHAR(8) UNIQUE,
ADD COLUMN IF NOT EXISTS is_registration_locked BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Code generator function for clean, readable codes (e.g. 'ABC-123')
-- Excludes visually ambiguous characters (0, O, 1, I)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_advisor_registration_code()
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

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Backfill existing advisors with random registration codes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    adv RECORD;
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    FOR adv IN SELECT staff_id FROM advisors WHERE registration_code IS NULL LOOP
        LOOP
            new_code := generate_advisor_registration_code();
            SELECT EXISTS (SELECT 1 FROM advisors WHERE registration_code = new_code) INTO code_exists;
            IF NOT code_exists THEN
                EXIT;
            END IF;
        END LOOP;

        UPDATE advisors
        SET 
            registration_code = new_code,
            is_registration_locked = COALESCE(is_registration_locked, false)
        WHERE staff_id = adv.staff_id;
    END LOOP;
END $$;

-- Enforce constraints
ALTER TABLE advisors ALTER COLUMN registration_code SET NOT NULL;
ALTER TABLE advisors ALTER COLUMN is_registration_locked SET NOT NULL;

-- Create index for instant code lookups during student registration
CREATE INDEX IF NOT EXISTS idx_advisors_registration_code ON advisors(registration_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Row Level Security (RLS) Policies on advisors
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;

-- 4a. Allow anyone (anon + authenticated) to query advisors for registration validation
DROP POLICY IF EXISTS "Public can verify advisor registration code" ON advisors;
DROP POLICY IF EXISTS "Anyone can read advisors for code validation" ON advisors;
CREATE POLICY "Anyone can read advisors for code validation"
ON advisors FOR SELECT
TO anon, authenticated
USING (true);

-- 4b. Allow advisors to update their own registration code and lock status
-- Matches by email in JWT or user_id
DROP POLICY IF EXISTS "Advisors can update their own profile" ON advisors;
CREATE POLICY "Advisors can update their own profile"
ON advisors FOR UPDATE
TO authenticated
USING (
    institutional_email = (auth.jwt() ->> 'email')
    OR user_id = auth.uid()
)
WITH CHECK (
    institutional_email = (auth.jwt() ->> 'email')
    OR user_id = auth.uid()
);
