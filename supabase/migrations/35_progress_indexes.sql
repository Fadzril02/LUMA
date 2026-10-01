-- =============================================================================
-- Migration: 35_progress_indexes.sql
-- Description: Performance optimization indexes for degree audit progress check.
-- 
-- Audit of existing indexes:
-- 1. template_courses(template_id) -> ALREADY EXISTS:
--    idx_template_courses_template_id created in 08_multi_tenant_blueprint_architecture.sql.
-- 2. elective_assignments(tenant_id, matric_no) -> ALREADY EXISTS:
--    idx_elective_assignments_tenant_matric created in 33_elective_assignments.sql.
-- 3. academic_records(tenant_id, matric_no) -> ADDING:
--    Accelerates loading all academic records for a given student in /audit/progress/{matric_no}.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_academic_records_tenant_matric
    ON public.academic_records (tenant_id, matric_no);

-- =============================================================================
-- VERIFY QUERIES
-- =============================================================================
-- Run the following queries to verify the presence of all required indexes for progress performance:
--
-- 1. Verify academic_records(tenant_id, matric_no):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'academic_records' AND indexname = 'idx_academic_records_tenant_matric';
--
-- 2. Verify template_courses(template_id) from migration 08:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'template_courses' AND indexname = 'idx_template_courses_template_id';
--
-- 3. Verify elective_assignments(tenant_id, matric_no) from migration 33:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'elective_assignments' AND indexname = 'idx_elective_assignments_tenant_matric';

/*
-- =============================================================================
-- ROLLBACK
-- =============================================================================
BEGIN;
DROP INDEX IF EXISTS public.idx_academic_records_tenant_matric;
COMMIT;
*/
