BEGIN;

-- 1. Add elective slot metadata columns to template_courses
ALTER TABLE template_courses
    ADD COLUMN IF NOT EXISTS is_elective_slot BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS slot_no INT NULL,
    ADD COLUMN IF NOT EXISTS match_patterns TEXT[] NULL;

-- 2. Drop legacy unique constraint that blocked repeated slot patterns
ALTER TABLE template_courses
    DROP CONSTRAINT IF EXISTS uq_template_courses_template_course;

-- 3. Partial unique index: concrete courses must remain unique per template
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_courses_real_course 
    ON template_courses (template_id, course_code) 
    WHERE is_elective_slot = false;

-- 4. Partial index for ordered slot retrieval per template
CREATE INDEX IF NOT EXISTS idx_template_courses_slots
    ON template_courses (template_id, slot_no)
    WHERE is_elective_slot = true;

COMMIT;

/*
-- ROLLBACK SCRIPT
BEGIN;
DROP INDEX IF EXISTS idx_template_courses_slots;
DROP INDEX IF EXISTS uq_template_courses_real_course;
ALTER TABLE template_courses
    ADD CONSTRAINT uq_template_courses_template_course UNIQUE (template_id, course_code);
ALTER TABLE template_courses
    DROP COLUMN IF EXISTS match_patterns,
    DROP COLUMN IF EXISTS slot_no,
    DROP COLUMN IF EXISTS is_elective_slot;
COMMIT;
*/
