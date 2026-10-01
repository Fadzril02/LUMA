-- =============================================================================
-- Migration 34: Curriculum template ownership and auditing (SynGrad Roadmap 4C)
--
-- Adds owner_staff_id to degree_templates to enforce that only the advisor who
-- uploaded the template may edit it.
-- Adds updated_at to template_courses for modification tracking.
-- =============================================================================
BEGIN;

-- 1. degree_templates: Add owner_staff_id (TEXT NULL, no auto-backfill)
ALTER TABLE public.degree_templates
    ADD COLUMN IF NOT EXISTS owner_staff_id TEXT NULL;

-- 2. template_courses: Add updated_at (TIMESTAMPTZ DEFAULT now())
ALTER TABLE public.template_courses
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMIT;

-- =============================================================================
-- VERIFY QUERIES
-- =============================================================================
-- 1. Verify owner_staff_id column on degree_templates:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'degree_templates' AND column_name = 'owner_staff_id';
--
-- 2. Verify updated_at column on template_courses:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'template_courses' AND column_name = 'updated_at';

/*
-- =============================================================================
-- ROLLBACK
-- =============================================================================
BEGIN;
ALTER TABLE public.degree_templates DROP COLUMN IF EXISTS owner_staff_id;
ALTER TABLE public.template_courses DROP COLUMN IF EXISTS updated_at;
COMMIT;
*/
