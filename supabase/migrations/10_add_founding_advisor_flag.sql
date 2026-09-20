-- ==============================================================================
-- Migration: Add Founding Advisor Flag to Advisors Table
-- Version: 10_add_founding_advisor_flag.sql
-- Description:
--   Adds is_founding_advisor boolean flag to the advisors table.
--   When set to true, grants permanently free, full access to LUMA features
--   for the Phase 1 UAT Pilot Founding Advisors (capped at 5 advisors).
-- ==============================================================================

-- 1. Add is_founding_advisor column idempotently
ALTER TABLE advisors
ADD COLUMN IF NOT EXISTS is_founding_advisor BOOLEAN NOT NULL DEFAULT false;

-- 2. Index for rapid lookup of founding advisors
CREATE INDEX IF NOT EXISTS idx_advisors_founding 
ON advisors(is_founding_advisor) 
WHERE is_founding_advisor = true;

-- 3. Comment explaining business logic
COMMENT ON COLUMN advisors.is_founding_advisor IS 
'Flags founding advisors during Phase 1 UAT Pilot (capped at 5). Grants permanently free, full access across all platform capabilities.';
