BEGIN;

-- 1. Drop email-based policy and public listing of cohort codes
DROP POLICY IF EXISTS "Advisors can manage their own cohorts" ON cohorts;
DROP POLICY IF EXISTS "Public can view active unlocked cohorts" ON cohorts;

-- 2. Advisors manage only their own cohorts (user_id-based, no email)
CREATE POLICY "cohorts_select_own" ON cohorts FOR SELECT TO authenticated
USING (advisor_staff_id IN (SELECT my_staff_ids()));

CREATE POLICY "cohorts_insert_own" ON cohorts FOR INSERT TO authenticated
WITH CHECK (advisor_staff_id IN (SELECT my_staff_ids()));

CREATE POLICY "cohorts_update_own" ON cohorts FOR UPDATE TO authenticated
USING (advisor_staff_id IN (SELECT my_staff_ids()))
WITH CHECK (advisor_staff_id IN (SELECT my_staff_ids()));

CREATE POLICY "cohorts_delete_own" ON cohorts FOR DELETE TO authenticated
USING (advisor_staff_id IN (SELECT my_staff_ids()));

-- 3. tenant_id is always taken from the owning advisor, never from the client
CREATE OR REPLACE FUNCTION set_cohort_tenant_from_advisor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE adv_tenant TEXT;
BEGIN
    SELECT tenant_id INTO adv_tenant FROM advisors WHERE staff_id = NEW.advisor_staff_id;
    IF adv_tenant IS NULL THEN
        RAISE EXCEPTION 'Cohort advisor % not found or has no tenant', NEW.advisor_staff_id;
    END IF;
    NEW.tenant_id := adv_tenant;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cohort_tenant ON cohorts;
CREATE TRIGGER trg_cohort_tenant BEFORE INSERT OR UPDATE ON cohorts
FOR EACH ROW EXECUTE FUNCTION set_cohort_tenant_from_advisor();

-- 4. Fix any existing rows
UPDATE cohorts c SET tenant_id = a.tenant_id FROM advisors a
WHERE a.staff_id = c.advisor_staff_id AND c.tenant_id IS DISTINCT FROM a.tenant_id;

ALTER TABLE cohorts ALTER COLUMN tenant_id SET NOT NULL;

COMMIT;

/*
-- ROLLBACK
BEGIN;
DROP TRIGGER IF EXISTS trg_cohort_tenant ON cohorts;
DROP FUNCTION IF EXISTS set_cohort_tenant_from_advisor();
DROP POLICY IF EXISTS "cohorts_select_own" ON cohorts;
DROP POLICY IF EXISTS "cohorts_insert_own" ON cohorts;
DROP POLICY IF EXISTS "cohorts_update_own" ON cohorts;
DROP POLICY IF EXISTS "cohorts_delete_own" ON cohorts;
ALTER TABLE cohorts ALTER COLUMN tenant_id DROP NOT NULL;
CREATE POLICY "Advisors can manage their own cohorts" ON cohorts FOR ALL TO authenticated
USING ((advisor_staff_id)::text IN (SELECT staff_id FROM advisors WHERE institutional_email = (auth.jwt() ->> 'email') OR user_id = auth.uid()))
WITH CHECK ((advisor_staff_id)::text IN (SELECT staff_id FROM advisors WHERE institutional_email = (auth.jwt() ->> 'email') OR user_id = auth.uid()));
CREATE POLICY "Public can view active unlocked cohorts" ON cohorts FOR SELECT TO anon, authenticated USING (is_locked = false);
COMMIT;
*/
