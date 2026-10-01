-- =============================================================================
-- Migration 30: storage bucket + degree_audits access
--
-- FOUND (live, 2026-10-01):
--   storage "Allow all uploads to academic-slips"  INSERT  TO public  (anyone, even logged out, could upload)
--   storage "Allow authenticated PDF reads"        SELECT  TO authenticated, bucket only
--        -> ANY logged-in user could read EVERY student's result slip (PDPA leak)
--   degree_audits: RLS on, no policies (unreadable by users; backend only)
--
-- AFTER:
--   Upload: logged-in student, only to slips/<own matric>_<timestamp>.<ext>
--   Read:   only files that belong to an uploaded_documents row the caller can see
--           (uploaded_documents RLS from migration 29: student own / advisor advisees)
--   No user UPDATE/DELETE on slip files (backend service role only)
--   degree_audits: student reads own, advisor reads advisees'
-- Backend uses the service role and is unaffected.
-- =============================================================================
BEGIN;

-- Bucket must be private (signed URLs still work for authorised users)
UPDATE storage.buckets SET public = false WHERE id = 'academic-slips';

DROP POLICY IF EXISTS "Allow all uploads to academic-slips" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated PDF reads" ON storage.objects;

CREATE POLICY "academic_slips_student_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'academic-slips'
    AND split_part(name, '/', 1) = 'slips'
    AND split_part(split_part(name, '/', 2), '_', 1) IN (SELECT matric_no FROM public.my_matric_nos())
);

CREATE POLICY "academic_slips_read_own_or_advisee" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'academic-slips'
    AND name IN (SELECT file_path FROM public.uploaded_documents)  -- filtered by uploaded_documents RLS
);

-- degree_audits read access
DROP POLICY IF EXISTS "degree_audits_student_select" ON public.degree_audits;
DROP POLICY IF EXISTS "degree_audits_advisor_select" ON public.degree_audits;

CREATE POLICY "degree_audits_student_select" ON public.degree_audits
FOR SELECT TO authenticated
USING (matric_no IN (SELECT matric_no FROM public.my_matric_nos()));

CREATE POLICY "degree_audits_advisor_select" ON public.degree_audits
FOR SELECT TO authenticated
USING (matric_no IN (SELECT matric_no FROM public.my_advisee_matric_nos()));

COMMIT;

-- Verify:
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
--   -> academic_slips_student_upload (INSERT), academic_slips_read_own_or_advisee (SELECT)
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='degree_audits';
--   -> degree_audits_student_select, degree_audits_advisor_select
-- SELECT id, public FROM storage.buckets WHERE id='academic-slips';  -> public = false

/*
-- ROLLBACK (restores the previous, insecure state)
BEGIN;
DROP POLICY IF EXISTS "academic_slips_student_upload" ON storage.objects;
DROP POLICY IF EXISTS "academic_slips_read_own_or_advisee" ON storage.objects;
CREATE POLICY "Allow all uploads to academic-slips" ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'academic-slips');
CREATE POLICY "Allow authenticated PDF reads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'academic-slips');
DROP POLICY IF EXISTS "degree_audits_student_select" ON public.degree_audits;
DROP POLICY IF EXISTS "degree_audits_advisor_select" ON public.degree_audits;
COMMIT;
*/
