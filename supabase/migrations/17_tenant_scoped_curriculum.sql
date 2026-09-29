BEGIN;

-- Step 1: Backup (kept for rollback)
CREATE TABLE degree_templates_backup_17 AS SELECT * FROM degree_templates;

-- Step 2: Remove UTM default and old uniqueness
ALTER TABLE degree_templates DROP CONSTRAINT IF EXISTS uq_degree_templates_univ_prog_year;
ALTER TABLE degree_templates ALTER COLUMN university_name DROP DEFAULT;

-- Step 3: Backfill tenant_id -- none needed (table empty at time of writing)

-- Step 4: Integrity checks
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM degree_templates WHERE tenant_id IS NULL) THEN
        RAISE EXCEPTION 'Migration halted: degree_templates rows with NULL tenant_id exist.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM degree_templates
        GROUP BY tenant_id, program_code, syllabus_year HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Migration halted: duplicate (tenant_id, program_code, syllabus_year).';
    END IF;
END $$;

-- Step 5: Enforce tenant scoping
ALTER TABLE degree_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE degree_templates ADD CONSTRAINT uq_degree_templates_tenant_prog_year UNIQUE (tenant_id, program_code, syllabus_year);

-- Step 6: Prerequisites storage per template course
ALTER TABLE template_courses ADD COLUMN IF NOT EXISTS prerequisites JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;

/*
-- ROLLBACK
BEGIN;
ALTER TABLE template_courses DROP COLUMN IF EXISTS prerequisites;
ALTER TABLE degree_templates DROP CONSTRAINT IF EXISTS uq_degree_templates_tenant_prog_year;
ALTER TABLE degree_templates ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE degree_templates ALTER COLUMN university_name SET DEFAULT 'Universiti Teknologi Malaysia';
ALTER TABLE degree_templates ADD CONSTRAINT uq_degree_templates_univ_prog_year UNIQUE (university_name, program_code, syllabus_year);
UPDATE degree_templates dt SET tenant_id = b.tenant_id FROM degree_templates_backup_17 b WHERE dt.id = b.id;
DROP TABLE degree_templates_backup_17;
COMMIT;
*/
