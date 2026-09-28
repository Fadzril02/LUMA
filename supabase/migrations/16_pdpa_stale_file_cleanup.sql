-- ==============================================================================
-- Migration 16: PDPA Stale Document Cleanup & Abandoned File Maintenance
-- 
-- Regulatory Compliance:
-- Malaysia Personal Data Protection Act 2010 (PDPA) - Section 10 (Retention Principle)
-- Personal data processed for any purpose shall not be kept longer than is necessary.
-- Any uploaded transcript or examination slip that is NOT Approved within 7 days
-- is considered abandoned or rejected and must be permanently expunged.
-- ==============================================================================

-- 1. Create cleanup maintenance function
CREATE OR REPLACE FUNCTION purge_stale_uploaded_documents()
RETURNS TABLE(deleted_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    purged_rows INT := 0;
BEGIN
    -- Query & Delete unapproved documents older than 7 days
    WITH deleted AS (
        DELETE FROM public.uploaded_documents
        WHERE processing_status != 'Approved'
          AND (
            -- Support both column conventions if present
            uploaded_at < NOW() - INTERVAL '7 days'
          )
        RETURNING id
    )
    SELECT COUNT(*)::INT INTO purged_rows FROM deleted;

    -- Audit log record if rows were deleted
    IF purged_rows > 0 THEN
        INSERT INTO public.system_audit_logs (
            admin_staff_id,
            action_type,
            target_table,
            description
        ) VALUES (
            NULL,
            'DELETE',
            'uploaded_documents',
            format('PDPA Retention Enforcement: Purged %s unapproved document records older than 7 days.', purged_rows)
        );
    END IF;

    RETURN QUERY SELECT purged_rows;
END;
$$;

-- 2. Schedule automated cron execution if pg_cron is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN
            PERFORM cron.unschedule('pdpa-stale-file-cleanup');
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        PERFORM cron.schedule(
            'pdpa-stale-file-cleanup',
            '0 2 * * *', -- Daily at 02:00 AM UTC
            'SELECT purge_stale_uploaded_documents();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron not enabled or permission denied: %', SQLERRM;
END;
$$;
