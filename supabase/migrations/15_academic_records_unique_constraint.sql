-- Migration: Multi-Tenant composite unique constraint on academic_records
-- Required for the TRUE UPSERT strategy in supabase_client.py persist_audit_results().
-- on_conflict="tenant_id,matric_no,course_code" requires this constraint to exist.

-- Step 1: Add tenant_id column if it does not already exist (backfills existing rows to UTM)
ALTER TABLE public.academic_records
    ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'UTM';

-- Step 2: Drop old two-column constraint if it was previously created
ALTER TABLE public.academic_records
    DROP CONSTRAINT IF EXISTS academic_records_matric_no_course_code_key;

-- Step 3: Drop new three-column constraint before re-adding (idempotent)
ALTER TABLE public.academic_records
    DROP CONSTRAINT IF EXISTS academic_records_tenant_id_matric_no_course_code_key;

-- Step 4: Create the three-column composite unique constraint
ALTER TABLE public.academic_records
    ADD CONSTRAINT academic_records_tenant_id_matric_no_course_code_key
    UNIQUE (tenant_id, matric_no, course_code);
