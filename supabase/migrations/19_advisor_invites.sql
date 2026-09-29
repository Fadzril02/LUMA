BEGIN;

-- =============================================================================
-- Migration: 19_advisor_invites.sql
-- Description: Create advisor_invites table for secure, atomic advisor onboarding.
-- Access: RLS enabled with NO public policies (service-role only).
-- =============================================================================

CREATE TABLE IF NOT EXISTS advisor_invites (
    code TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    used_by UUID NULL,
    used_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS strictly; service role maintains access, no public policies created
ALTER TABLE advisor_invites ENABLE ROW LEVEL SECURITY;

COMMIT;

/*
-- =============================================================================
-- ROLLBACK SCRIPT (Do not apply automatically)
-- =============================================================================
BEGIN;
DROP TABLE IF EXISTS advisor_invites CASCADE;
COMMIT;
*/
