-- Migration: Add UNIQUE constraint on academic_records (matric_no, course_code)
-- Required for the TRUE UPSERT strategy in supabase_client.py persist_audit_results().
-- Without this constraint the upsert on_conflict clause will error.

ALTER TABLE public.academic_records
    DROP CONSTRAINT IF EXISTS academic_records_matric_no_course_code_key;

ALTER TABLE public.academic_records
    ADD CONSTRAINT academic_records_matric_no_course_code_key
    UNIQUE (matric_no, course_code);
