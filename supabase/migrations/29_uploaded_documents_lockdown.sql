-- =============================================================================
-- Migration 29: uploaded_documents lockdown
-- Students may only VIEW and INSERT their own uploads. Extracted grades,
-- fraud flag and status are written by the backend (service role) only.
-- Advisors may VIEW their advisees' uploads; approve/reject go through the backend.
-- Replaces the legacy email-based advisor policy.
-- APPLY ONLY AFTER the matching backend + frontend are deployed.
-- =============================================================================
BEGIN;

DROP POLICY IF EXISTS "uploaded_documents_advisor_access" ON uploaded_documents;
DROP POLICY IF EXISTS "uploaded_documents_student_access" ON uploaded_documents;

CREATE POLICY "uploaded_documents_student_select" ON uploaded_documents
FOR SELECT TO authenticated
USING (matric_no IN (SELECT matric_no FROM my_matric_nos()));

CREATE POLICY "uploaded_documents_student_insert" ON uploaded_documents
FOR INSERT TO authenticated
WITH CHECK (matric_no IN (SELECT matric_no FROM my_matric_nos()));

CREATE POLICY "uploaded_documents_advisor_select" ON uploaded_documents
FOR SELECT TO authenticated
USING (matric_no IN (SELECT matric_no FROM my_advisee_matric_nos()));

-- No UPDATE / DELETE policies: backend (service role) only.

-- On insert by a normal user: force the initial status and refuse client-supplied results.
CREATE OR REPLACE FUNCTION guard_uploaded_documents_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    jwt_claims TEXT;
BEGIN
    jwt_claims := current_setting('request.jwt.claims', true);
    IF jwt_claims IS NULL OR jwt_claims = '' OR (jwt_claims::json->>'role') = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.extracted_data IS NOT NULL AND NEW.extracted_data::text NOT IN ('{}', 'null') THEN
        RAISE EXCEPTION 'extracted_data can only be set by the server';
    END IF;

    NEW.processing_status := 'Pending_Student_Verification';
    NEW.fraud_flag := false;
    NEW.processing_error := NULL;
    NEW.extracted_cgpa := NULL;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_uploaded_documents_insert ON uploaded_documents;
CREATE TRIGGER trg_guard_uploaded_documents_insert
BEFORE INSERT ON uploaded_documents
FOR EACH ROW EXECUTE FUNCTION guard_uploaded_documents_insert();

COMMIT;

-- Verify:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'uploaded_documents';
-- Expected: uploaded_documents_student_select (SELECT), uploaded_documents_student_insert (INSERT),
--           uploaded_documents_advisor_select (SELECT)

/*
-- ROLLBACK (restores previous, less secure policies)
BEGIN;
DROP TRIGGER IF EXISTS trg_guard_uploaded_documents_insert ON uploaded_documents;
DROP FUNCTION IF EXISTS guard_uploaded_documents_insert();
DROP POLICY IF EXISTS "uploaded_documents_student_select" ON uploaded_documents;
DROP POLICY IF EXISTS "uploaded_documents_student_insert" ON uploaded_documents;
DROP POLICY IF EXISTS "uploaded_documents_advisor_select" ON uploaded_documents;
CREATE POLICY "uploaded_documents_student_access" ON uploaded_documents FOR ALL TO authenticated
USING (matric_no IN (SELECT students.matric_no FROM students WHERE students.user_id = auth.uid()));
CREATE POLICY "uploaded_documents_advisor_access" ON uploaded_documents FOR ALL TO authenticated
USING (matric_no IN (SELECT students.matric_no FROM students WHERE students.advisor_staff_id IN
  (SELECT advisors.staff_id FROM advisors WHERE advisors.institutional_email::text = (auth.jwt() ->> 'email'))));
COMMIT;
*/
