-- ==============================================================================
-- Migration: Add Founding Advisor Schema
-- Version: 11_add_founding_advisor_schema.sql
-- Description:
--   Adds the is_founding_advisor flag to the live advisors table.
-- ==============================================================================

ALTER TABLE advisors
  ADD COLUMN IF NOT EXISTS is_founding_advisor BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_advisors_founding
  ON advisors(is_founding_advisor)
  WHERE is_founding_advisor = true;

COMMENT ON COLUMN advisors.is_founding_advisor IS
  'Flags founding advisors during Phase 1 UAT Pilot (capped at 5). Grants permanently free, full access across all platform capabilities.';
