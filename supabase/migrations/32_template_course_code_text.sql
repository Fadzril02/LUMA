-- 32: elective slot codes listing many courses exceed varchar(50)
BEGIN;
ALTER TABLE public.template_courses ALTER COLUMN course_code TYPE TEXT;
ALTER TABLE public.template_courses ALTER COLUMN course_name TYPE TEXT;
COMMIT;

-- VERIFY
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'template_courses' AND column_name IN ('course_code','course_name');
