BEGIN;

-- =============================================================================
-- Migration: 24_advising_logs_v2.sql
-- Description: Advising logs v2 schema, tenant-guard triggers, and strict RLS.
-- =============================================================================

-- 1. Add new columns
ALTER TABLE public.advising_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Backfill tenant_id from students
UPDATE public.advising_logs al
SET tenant_id = s.tenant_id
FROM public.students s
WHERE s.matric_no = al.student_matric_no
  AND al.tenant_id IS NULL;

-- Abort if any row cannot be backfilled
DO $$
DECLARE
    orphan_count INT;
BEGIN
    SELECT count(*) INTO orphan_count
    FROM public.advising_logs
    WHERE tenant_id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot backfill tenant_id on advising_logs: % rows have no matching student tenant', orphan_count;
    END IF;
END $$;

ALTER TABLE public.advising_logs ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.advising_logs 
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared' 
CHECK (visibility IN ('shared', 'private'));

ALTER TABLE public.advising_logs 
ADD COLUMN IF NOT EXISTS follow_up_date DATE NULL;

-- 2. Trigger BEFORE INSERT/UPDATE:
-- Set tenant_id from student row, and advisor_staff_id must be in my_staff_ids()
-- (unless service_role or direct DB/SQL editor with no JWT claims)
CREATE OR REPLACE FUNCTION set_advising_log_tenant_and_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    stu_tenant TEXT;
    jwt_claims TEXT;
    jwt_role TEXT;
BEGIN
    -- Set tenant_id from the student row
    SELECT tenant_id INTO stu_tenant
    FROM public.students
    WHERE matric_no = NEW.student_matric_no;

    IF stu_tenant IS NULL THEN
        RAISE EXCEPTION 'Student % not found or has no tenant_id', NEW.student_matric_no;
    END IF;
    NEW.tenant_id := stu_tenant;

    -- advisor_staff_id must be one of my_staff_ids() (unless service_role or no JWT claims)
    jwt_claims := current_setting('request.jwt.claims', true);
    IF jwt_claims IS NOT NULL AND jwt_claims <> '' THEN
        jwt_role := jwt_claims::json->>'role';
        IF jwt_role IS DISTINCT FROM 'service_role' THEN
            IF NOT (NEW.advisor_staff_id IN (SELECT my_staff_ids())) THEN
                RAISE EXCEPTION 'advisor_staff_id % must match the authenticated advisor staff_id', NEW.advisor_staff_id;
            END IF;
        END IF;
    END IF;

    -- Edits can never move a note to another student/advisor or reset the 24h edit window
    IF TG_OP = 'UPDATE' THEN
        NEW.created_at        := OLD.created_at;
        NEW.student_matric_no := OLD.student_matric_no;
        NEW.advisor_staff_id  := OLD.advisor_staff_id;
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_advising_logs_guard ON public.advising_logs;
CREATE TRIGGER trg_advising_logs_guard
BEFORE INSERT OR UPDATE ON public.advising_logs
FOR EACH ROW EXECUTE FUNCTION set_advising_log_tenant_and_guard();

-- 3. Drop the 3 existing legacy policies
DROP POLICY IF EXISTS "Advisors can view their own advisees logs" ON public.advising_logs;
DROP POLICY IF EXISTS "Advisors can insert logs for their advisees" ON public.advising_logs;
DROP POLICY IF EXISTS "Students can view their own logs" ON public.advising_logs;

-- Clean up any existing v2 policies if re-run
DROP POLICY IF EXISTS "advising_logs_advisor_select" ON public.advising_logs;
DROP POLICY IF EXISTS "advising_logs_advisor_insert" ON public.advising_logs;
DROP POLICY IF EXISTS "advising_logs_advisor_update" ON public.advising_logs;
DROP POLICY IF EXISTS "advising_logs_student_select" ON public.advising_logs;

-- 4. New policies using migration-20 helpers
-- advisor SELECT/INSERT
CREATE POLICY "advising_logs_advisor_select"
ON public.advising_logs FOR SELECT
TO authenticated
USING (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
    AND advisor_staff_id IN (SELECT my_staff_ids())
);

CREATE POLICY "advising_logs_advisor_insert"
ON public.advising_logs FOR INSERT
TO authenticated
WITH CHECK (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
    AND advisor_staff_id IN (SELECT my_staff_ids())
);

-- advisor UPDATE: the same, plus created_at > now() - interval '24 hours'
CREATE POLICY "advising_logs_advisor_update"
ON public.advising_logs FOR UPDATE
TO authenticated
USING (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
    AND advisor_staff_id IN (SELECT my_staff_ids())
    AND created_at > now() - interval '24 hours'
)
WITH CHECK (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_advisee_matric_nos())
    AND advisor_staff_id IN (SELECT my_staff_ids())
    AND created_at > now() - interval '24 hours'
);

-- student SELECT: only own logs with shared visibility
CREATE POLICY "advising_logs_student_select"
ON public.advising_logs FOR SELECT
TO authenticated
USING (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_matric_nos())
    AND visibility = 'shared'
);

-- No DELETE policy (audit trail)

COMMIT;

/*
-- ROLLBACK
BEGIN;
DROP TRIGGER IF EXISTS trg_advising_logs_guard ON public.advising_logs;
DROP FUNCTION IF EXISTS set_advising_log_tenant_and_guard();
DROP POLICY IF EXISTS "advising_logs_advisor_select" ON public.advising_logs;
DROP POLICY IF EXISTS "advising_logs_advisor_insert" ON public.advising_logs;
DROP POLICY IF EXISTS "advising_logs_advisor_update" ON public.advising_logs;
DROP POLICY IF EXISTS "advising_logs_student_select" ON public.advising_logs;

CREATE POLICY "Advisors can view their own advisees logs"
ON public.advising_logs FOR SELECT
USING (advisor_staff_id = (SELECT staff_id FROM advisors WHERE user_id = auth.uid()));

CREATE POLICY "Advisors can insert logs for their advisees"
ON public.advising_logs FOR INSERT
WITH CHECK (advisor_staff_id = (SELECT staff_id FROM advisors WHERE user_id = auth.uid()));

CREATE POLICY "Students can view their own logs"
ON public.advising_logs FOR SELECT
USING (student_matric_no = (SELECT matric_no FROM students WHERE user_id = auth.uid()));

ALTER TABLE public.advising_logs DROP COLUMN IF EXISTS follow_up_date;
ALTER TABLE public.advising_logs DROP COLUMN IF EXISTS visibility;
ALTER TABLE public.advising_logs DROP COLUMN IF EXISTS tenant_id;
COMMIT;
*/
