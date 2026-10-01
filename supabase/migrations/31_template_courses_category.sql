-- 31: store the curriculum CSV category on template_courses.
-- Before this, upload kept only is_core_requirement and dropped the category name,
-- so /audit/progress (which groups by category) failed with 42703.
BEGIN;

ALTER TABLE public.template_courses ADD COLUMN IF NOT EXISTS category TEXT;

-- Backfill existing rows from data already stored (no guessing beyond these flags).
-- Re-upload the curriculum CSV to restore the original category names.
UPDATE public.template_courses
SET category = CASE
    WHEN is_elective_slot THEN 'Elective'
    WHEN is_core_requirement THEN 'Core'
    ELSE 'Other'
END
WHERE category IS NULL;

ALTER TABLE public.template_courses ALTER COLUMN category SET NOT NULL;

COMMIT;

-- VERIFY
-- SELECT category, count(*) FROM public.template_courses GROUP BY category;

-- ROLLBACK
-- ALTER TABLE public.template_courses DROP COLUMN IF EXISTS category;
