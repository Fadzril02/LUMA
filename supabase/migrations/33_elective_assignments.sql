-- =============================================================================
-- Migration 33: Manual elective overrides (SynGrad Roadmap 4B)
--
-- Table public.elective_assignments stores advisor overrides for elective slots:
--   - 'assign': pins a passing course attempt to a specific elective slot.
--   - 'exclude': removes a passing course attempt from matching any requirement.
--
-- RLS:
--   - Authenticated student can SELECT own rows via my_matric_nos().
--   - Authenticated advisor can SELECT advisees' rows via my_advisee_matric_nos().
--   - All INSERT/UPDATE/DELETE operations are performed by the backend service role.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.elective_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    matric_no TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('assign', 'exclude')),
    template_course_id UUID NULL REFERENCES public.template_courses(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    assigned_by_staff_id TEXT NOT NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_elective_assignments_kind_slot
        CHECK (
            (kind = 'assign' AND template_course_id IS NOT NULL) OR
            (kind = 'exclude' AND template_course_id IS NULL)
        ),
    CONSTRAINT uq_elective_assignments_course
        UNIQUE (tenant_id, matric_no, course_code)
);

-- Partial unique index: a template slot has at most one assignment per student
CREATE UNIQUE INDEX IF NOT EXISTS uq_elective_assignments_slot_assign
    ON public.elective_assignments (tenant_id, matric_no, template_course_id)
    WHERE kind = 'assign';

-- Query indexing
CREATE INDEX IF NOT EXISTS idx_elective_assignments_tenant_matric
    ON public.elective_assignments (tenant_id, matric_no);

CREATE INDEX IF NOT EXISTS idx_elective_assignments_template_course
    ON public.elective_assignments (template_course_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.elective_assignments ENABLE ROW LEVEL SECURITY;

-- Read policies: student reads own; advisor reads advisees'
DROP POLICY IF EXISTS "elective_assignments_student_select" ON public.elective_assignments;
CREATE POLICY "elective_assignments_student_select" ON public.elective_assignments
FOR SELECT TO authenticated
USING (matric_no IN (SELECT matric_no FROM public.my_matric_nos()));

DROP POLICY IF EXISTS "elective_assignments_advisor_select" ON public.elective_assignments;
CREATE POLICY "elective_assignments_advisor_select" ON public.elective_assignments
FOR SELECT TO authenticated
USING (matric_no IN (SELECT matric_no FROM public.my_advisee_matric_nos()));

-- Note: No INSERT, UPDATE, or DELETE policies are granted to authenticated or anon.
-- All writes must route through backend service-role endpoints.

COMMIT;

-- =============================================================================
-- VERIFY QUERIES
-- =============================================================================
-- 1. Check table structure and column types:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'elective_assignments'
-- ORDER BY ordinal_position;
--
-- 2. Check foreign key reference to template_courses:
-- SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'elective_assignments' AND tc.constraint_type = 'FOREIGN KEY';
--
-- 3. Check RLS policies:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'elective_assignments';
--
-- 4. Check unique indices:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'elective_assignments';

/*
-- =============================================================================
-- ROLLBACK
-- =============================================================================
BEGIN;
DROP TABLE IF EXISTS public.elective_assignments CASCADE;
COMMIT;
*/
