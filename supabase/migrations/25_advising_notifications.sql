BEGIN;

-- =============================================================================
-- Migration: 25_advising_notifications.sql
-- Description: Advising note notifications tracking and student read receipt.
-- =============================================================================

-- 1. Add notification timestamp and student seen timestamp columns
ALTER TABLE public.advising_logs 
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ NULL;

ALTER TABLE public.advising_logs 
ADD COLUMN IF NOT EXISTS student_seen_at TIMESTAMPTZ NULL;

-- 2. Trigger BEFORE INSERT/UPDATE:
-- Guard tenant, advisor ownership on insert/update, and allow students to
-- update ONLY student_seen_at on their own shared logs.
CREATE OR REPLACE FUNCTION set_advising_log_tenant_and_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    stu_tenant TEXT;
    jwt_claims TEXT;
    jwt_role TEXT;
    is_service_caller BOOLEAN := false;
    is_owning_advisor BOOLEAN := false;
BEGIN
    -- Identify caller context
    jwt_claims := current_setting('request.jwt.claims', true);
    IF jwt_claims IS NULL OR jwt_claims = '' THEN
        is_service_caller := true;
    ELSE
        jwt_role := jwt_claims::json->>'role';
        IF jwt_role = 'service_role' THEN
            is_service_caller := true;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Set tenant_id from the student row
        SELECT tenant_id INTO stu_tenant
        FROM public.students
        WHERE matric_no = NEW.student_matric_no;

        IF stu_tenant IS NULL THEN
            RAISE EXCEPTION 'Student % not found or has no tenant_id', NEW.student_matric_no;
        END IF;
        NEW.tenant_id := stu_tenant;

        -- advisor_staff_id must be one of my_staff_ids() for non-service callers
        IF NOT is_service_caller THEN
            IF NOT (NEW.advisor_staff_id IN (SELECT my_staff_ids())) THEN
                RAISE EXCEPTION 'advisor_staff_id % must match the authenticated advisor staff_id', NEW.advisor_staff_id;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Prevent changing tenant_id, student_matric_no, advisor_staff_id, or created_at
        NEW.tenant_id         := OLD.tenant_id;
        NEW.created_at        := OLD.created_at;
        NEW.student_matric_no := OLD.student_matric_no;
        NEW.advisor_staff_id  := OLD.advisor_staff_id;

        IF NOT is_service_caller THEN
            -- Check if caller is the owning advisor
            IF OLD.advisor_staff_id IN (SELECT my_staff_ids()) THEN
                is_owning_advisor := true;
            END IF;

            -- If caller is NOT the owning advisor:
            -- Must only update student_seen_at on their own shared logs. Reject any other column change.
            IF NOT is_owning_advisor THEN
                IF (NEW.id IS DISTINCT FROM OLD.id)
                   OR (NEW.session_date IS DISTINCT FROM OLD.session_date)
                   OR (NEW.notes IS DISTINCT FROM OLD.notes)
                   OR (NEW.action_item IS DISTINCT FROM OLD.action_item)
                   OR (NEW.follow_up_date IS DISTINCT FROM OLD.follow_up_date)
                   OR (NEW.visibility IS DISTINCT FROM OLD.visibility)
                   OR (NEW.notified_at IS DISTINCT FROM OLD.notified_at) THEN
                    RAISE EXCEPTION 'Non-advisor callers may only update student_seen_at';
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_advising_logs_guard ON public.advising_logs;
CREATE TRIGGER trg_advising_logs_guard
BEFORE INSERT OR UPDATE ON public.advising_logs
FOR EACH ROW EXECUTE FUNCTION set_advising_log_tenant_and_guard();

-- 3. RLS: Allow student to update their own shared logs (trigger restricts columns to student_seen_at)
DROP POLICY IF EXISTS "advising_logs_student_update" ON public.advising_logs;
CREATE POLICY "advising_logs_student_update"
ON public.advising_logs FOR UPDATE
TO authenticated
USING (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_matric_nos())
    AND visibility = 'shared'
)
WITH CHECK (
    (tenant_id, student_matric_no) IN (SELECT tenant_id, matric_no FROM my_matric_nos())
    AND visibility = 'shared'
);

COMMIT;

/*
-- ROLLBACK
BEGIN;
DROP POLICY IF EXISTS "advising_logs_student_update" ON public.advising_logs;

CREATE OR REPLACE FUNCTION set_advising_log_tenant_and_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    stu_tenant TEXT;
    jwt_claims TEXT;
    jwt_role TEXT;
BEGIN
    SELECT tenant_id INTO stu_tenant
    FROM public.students
    WHERE matric_no = NEW.student_matric_no;

    IF stu_tenant IS NULL THEN
        RAISE EXCEPTION 'Student % not found or has no tenant_id', NEW.student_matric_no;
    END IF;
    NEW.tenant_id := stu_tenant;

    jwt_claims := current_setting('request.jwt.claims', true);
    IF jwt_claims IS NOT NULL AND jwt_claims <> '' THEN
        jwt_role := jwt_claims::json->>'role';
        IF jwt_role IS DISTINCT FROM 'service_role' THEN
            IF NOT (NEW.advisor_staff_id IN (SELECT my_staff_ids())) THEN
                RAISE EXCEPTION 'advisor_staff_id % must match the authenticated advisor staff_id', NEW.advisor_staff_id;
            END IF;
        END IF;
    END IF;

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

ALTER TABLE public.advising_logs DROP COLUMN IF EXISTS student_seen_at;
ALTER TABLE public.advising_logs DROP COLUMN IF EXISTS notified_at;
COMMIT;
*/
