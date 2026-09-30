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
-- Accepts ONLY explicit formats:
--   1. (SEM|SEMESTER) <1-4> <YYYY>/<YY or YYYY> (case-insensitive, optional punctuation)
--   2. <YYYY>/<YY or YYYY>-<1-4> or <YYYY>/<YY or YYYY> <1-4>
-- All guess fallbacks (single-year -> +1, fall/spring/summer mapping, bare digits)
-- have been removed. Strictly mirrors Python backend implementation.
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
    v_m TEXT[];
BEGIN
    IF p_label IS NULL OR trim(p_label) = '' THEN
        RAISE EXCEPTION 'Cannot normalise empty or missing semester label: %', p_label;
    END IF;

    v_raw := trim(p_label);

    -- Pattern 1: (SEM|SEMESTER) <1-4> <YYYY>/<YY or YYYY> (case-insensitive, optional punctuation)
    -- e.g. "SEM 1 2024/2025", "Sem 1 2024/25", "Semester 1 2024/2025", "SEMESTER 1 SESSION 2024/2025"
    v_m := regexp_matches(
        v_raw,
        '^(?:SEM(?:ESTER)?)\s*[:.]?\s*([1-4])\s*[:.,]?(?:\s*(?:SESSION|SESI))?\s*(\d{4})\s*[\/\-]\s*(\d{4}|\d{2})$',
        'i'
    );
    IF v_m IS NOT NULL AND array_length(v_m, 1) = 3 THEN
        v_sem := v_m[1]::INT;
        v_y1 := v_m[2]::INT;
        v_y2_str := v_m[3];
    ELSE
        -- Pattern 2: <YYYY>/<YY or YYYY>-<1-4> or <YYYY>/<YY or YYYY> <1-4>
        -- e.g. "2024/2025-1", "2024/2025 1", "2024/2025/1", "2024/25-2", "2024/2025 Sem 1"
        v_m := regexp_matches(
            v_raw,
            '^(\d{4})\s*[\/\-]\s*(\d{4}|\d{2})\s*[-\/\s]\s*(?:SEM(?:ESTER)?\s*[:.]?\s*)?([1-4])$',
            'i'
        );
        IF v_m IS NOT NULL AND array_length(v_m, 1) = 3 THEN
            v_y1 := v_m[1]::INT;
            v_y2_str := v_m[2];
            v_sem := v_m[3]::INT;
        END IF;
    END IF;

    IF v_y1 IS NULL OR v_y2_str IS NULL OR v_sem IS NULL THEN
        RAISE EXCEPTION 'Cannot normalise semester label: %', p_label;
    END IF;

    -- Expand 2-digit second year (e.g. 2024/25 -> 2025)
    IF length(v_y2_str) = 2 THEN
        v_y2 := (v_y1 / 100) * 100 + v_y2_str::INT;
    ELSE
        v_y2 := v_y2_str::INT;
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

-- Drift: a second 3-column unique constraint exists in production (created outside migrations).
-- It would still block retakes, so drop it too.
ALTER TABLE academic_records
    DROP CONSTRAINT IF EXISTS unique_tenant_matric_course;

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

-- =============================================================================
-- TEST SUITE / VERIFICATION SNIPPET: normalize_semester(p_label)
-- Run this block in psql / Supabase SQL Editor to verify output for all cases.
-- =============================================================================
/*
DO $$
DECLARE
    rec RECORD;
    v_actual TEXT;
    -- Test cases: input, expected_output, should_succeed
    v_tests JSONB := '[
        {"input": "Sem 1 2024/2025", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "Sem 2 2024/2025", "expected": "SEM 2 2024/2025", "ok": true},
        {"input": "SEM 1 2024/25", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "Semester 1 2024/2025", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "SEMESTER 1 SESSION 2024/2025", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "SEM: 2, 2023/2024", "expected": "SEM 2 2023/2024", "ok": true},
        {"input": "2024/2025-1", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "2024/2025 1", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "2024/2025/1", "expected": "SEM 1 2024/2025", "ok": true},
        {"input": "2024/25-2", "expected": "SEM 2 2024/2025", "ok": true},
        {"input": "2024/2025-3", "expected": "SEM 3 2024/2025", "ok": true},
        {"input": "2024/2025-4", "expected": "SEM 4 2024/2025", "ok": true},
        {"input": "FALL TERM 2024", "expected": NULL, "ok": false},
        {"input": "Spring 2025", "expected": NULL, "ok": false},
        {"input": "Summer 2024", "expected": NULL, "ok": false},
        {"input": "2024", "expected": NULL, "ok": false},
        {"input": "SEM 1 2024", "expected": NULL, "ok": false},
        {"input": "1", "expected": NULL, "ok": false},
        {"input": "Sem 1", "expected": NULL, "ok": false},
        {"input": "2024/2025", "expected": NULL, "ok": false},
        {"input": "Sem 5 2024/2025", "expected": NULL, "ok": false},
        {"input": "", "expected": NULL, "ok": false}
    ]'::JSONB;
BEGIN
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_tests) AS x(input TEXT, expected TEXT, ok BOOLEAN) LOOP
        BEGIN
            v_actual := normalize_semester(rec.input);
            IF NOT rec.ok THEN
                RAISE EXCEPTION 'TEST FAILED: "%" should have been REJECTED, but returned "%"', rec.input, v_actual;
            ELSIF v_actual <> rec.expected THEN
                RAISE EXCEPTION 'TEST FAILED: "%" -> got "%", expected "%"', rec.input, v_actual, rec.expected;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            IF rec.ok THEN
                RAISE EXCEPTION 'TEST FAILED: "%" raised exception unexpectedly: %', rec.input, SQLERRM;
            END IF;
        END;
    END LOOP;
    RAISE NOTICE 'ALL normalize_semester() SQL test cases passed successfully.';
END $$;
*/
