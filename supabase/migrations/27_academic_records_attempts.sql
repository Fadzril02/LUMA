-- =============================================================================
-- Migration: 27_academic_records_attempts.sql
-- Description: Multi-attempt support for academic records (retakes and distinct semesters).
--              Normalises semester values, replaces 3-column unique constraint with
--              4-column composite unique constraint (tenant_id, matric_no, course_code, semester),
--              and sets semester NOT NULL.
--
-- Free-tier safe: No new services, no cron.
-- Transactional: BEGIN / COMMIT with full rollback instructions included.
-- DO NOT APPLY UNTIL EXPLICITLY APPROVED.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SQL FUNCTION: normalize_semester(p_label TEXT)
-- Canonical format: 'SEM <number> <YYYY>/<YYYY>' (e.g. 'SEM 1 2024/2025')
-- Matches backend Python implementation.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_semester(p_label TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_raw TEXT;
    v_y1 INT;
    v_y2 INT;
    v_y2_str TEXT;
    v_sem INT;
    v_year_matches TEXT[];
    v_sem_matches TEXT[];
BEGIN
    IF p_label IS NULL OR trim(p_label) = '' THEN
        RAISE EXCEPTION 'Cannot normalise empty semester label';
    END IF;

    v_raw := trim(p_label);

    -- 1. Extract Academic Year YYYY/YYYY or YYYY/YY or YYYY-YYYY or YYYY-YY
    v_year_matches := regexp_matches(v_raw, '(\d{4})\s*[\/\-]\s*(\d{2,4})');
    IF v_year_matches IS NOT NULL AND array_length(v_year_matches, 1) >= 2 THEN
        v_y1 := v_year_matches[1]::INT;
        v_y2_str := v_year_matches[2];
        IF length(v_y2_str) = 2 THEN
            v_y2 := (v_y1 / 100) * 100 + v_y2_str::INT;
        ELSE
            v_y2 := v_y2_str::INT;
        END IF;
    ELSE
        -- Single 4-digit year fallback
        v_year_matches := regexp_matches(v_raw, '\b(20\d{2}|19\d{2})\b');
        IF v_year_matches IS NOT NULL AND array_length(v_year_matches, 1) >= 1 THEN
            v_y1 := v_year_matches[1]::INT;
            v_y2 := v_y1 + 1;
        END IF;
    END IF;

    -- 2. Extract Semester number
    v_sem_matches := regexp_matches(v_raw, '(?:SEM(?:ESTER)?|TERM|TRIMESTER|QUARTER)\s*[:.]?\s*([1-4])\b', 'i');
    IF v_sem_matches IS NOT NULL AND array_length(v_sem_matches, 1) >= 1 THEN
        v_sem := v_sem_matches[1]::INT;
    ELSE
        v_sem_matches := regexp_matches(v_raw, '[\/\-]\s*([1-4])\b');
        IF v_sem_matches IS NOT NULL AND array_length(v_sem_matches, 1) >= 1 THEN
            v_sem := v_sem_matches[1]::INT;
        ELSE
            IF v_raw ~* 'fall|autumn' THEN
                v_sem := 1;
            ELSIF v_raw ~* 'spring' THEN
                v_sem := 2;
            ELSIF v_raw ~* 'summer|special|short' THEN
                v_sem := 3;
            ELSE
                v_sem_matches := regexp_matches(v_raw, '\b([1-4])\b');
                IF v_sem_matches IS NOT NULL AND array_length(v_sem_matches, 1) >= 1 THEN
                    v_sem := v_sem_matches[1]::INT;
                END IF;
            END IF;
        END IF;
    END IF;

    IF v_y1 IS NULL OR v_y2 IS NULL OR v_sem IS NULL THEN
        RAISE EXCEPTION 'Cannot normalise semester label: %', p_label;
    END IF;

    RETURN 'SEM ' || v_sem || ' ' || v_y1 || '/' || v_y2;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. BACKFILL: Normalise existing semester values
-- -----------------------------------------------------------------------------
UPDATE academic_records
SET semester = normalize_semester(semester)
WHERE semester IS NOT NULL;

-- RAISE if any semester IS NULL after the backfill
DO $$
DECLARE
    v_null_count INT;
BEGIN
    SELECT COUNT(*) INTO v_null_count
    FROM academic_records
    WHERE semester IS NULL;

    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'academic_records contains % NULL semester row(s) after backfill', v_null_count;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. VALIDATION DO BLOCK: RAISE if duplicates exist on the new key
-- (tenant_id, matric_no, course_code, semester) before adding the constraint
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_dup_count INT;
BEGIN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT tenant_id, matric_no, course_code, semester, COUNT(*)
        FROM academic_records
        GROUP BY tenant_id, matric_no, course_code, semester
        HAVING COUNT(*) > 1
    ) sub;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'Cannot add UNIQUE constraint: % duplicate (tenant_id, matric_no, course_code, semester) group(s) found in academic_records', v_dup_count;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. CONSTRAINT UPDATE: Drop old key, set NOT NULL, add 4-column key
-- -----------------------------------------------------------------------------
ALTER TABLE academic_records
    DROP CONSTRAINT IF EXISTS academic_records_tenant_id_matric_no_course_code_key;

ALTER TABLE academic_records
    ALTER COLUMN semester SET NOT NULL;

ALTER TABLE academic_records
    ADD CONSTRAINT academic_records_tenant_matric_course_semester_key
    UNIQUE (tenant_id, matric_no, course_code, semester);

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (Do not run unless rolling back Migration 27)
-- =============================================================================
/*
BEGIN;

ALTER TABLE academic_records
    DROP CONSTRAINT IF EXISTS academic_records_tenant_matric_course_semester_key;

ALTER TABLE academic_records
    ADD CONSTRAINT academic_records_tenant_id_matric_no_course_code_key
    UNIQUE (tenant_id, matric_no, course_code);

DROP FUNCTION IF EXISTS normalize_semester(TEXT);

COMMIT;
*/
