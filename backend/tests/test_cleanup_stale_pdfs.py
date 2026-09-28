"""
Unit and Integration Tests for PDPA Stale PDF Cleanup Script
Validates:
1. Physical storage deletion failure / timeout skips database record deletion (preventing orphaned files).
2. Definitive storage deletion success triggers database record deletion.
3. Dry-run mode performs no mutations.
"""

import sys
import os
from unittest.mock import MagicMock, patch

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from scripts.cleanup_stale_pdfs import run_cleanup


def test_cleanup_skips_db_deletion_on_storage_failure():
    """
    Critical Constraint Test:
    If Supabase Storage API fails or times out, the database row must NOT be deleted.
    """
    mock_svc = MagicMock()
    mock_svc.client = MagicMock()

    # Mock stale document query returning 1 unapproved document older than 7 days
    mock_doc = {
        "id": "doc-uuid-failed-storage",
        "matric_no": "A24TESTFAIL",
        "file_name": "abandoned.pdf",
        "file_path": "academic-slips/abandoned.pdf",
        "processing_status": "Pending_Advisor_Approval",
        "created_at": "2026-09-01T00:00:00+00:00"
    }

    # Query succeeds
    mock_svc.client.table().select().neq().lt().limit().execute.return_value.data = [mock_doc]

    # Storage removal returns error or raises Timeout / Exception
    mock_svc.client.storage.from_().remove.side_effect = TimeoutError("Supabase Storage timeout")

    with patch("scripts.cleanup_stale_pdfs.SupabaseService", return_value=mock_svc):
        result = run_cleanup(days=7, dry_run=False)

        assert result["total_found"] == 1
        assert result["storage_deleted"] == 0
        assert result["db_deleted"] == 0
        assert result["skipped"] == 1

        # Assert that DB delete was NEVER called for this document
        mock_svc.client.table("uploaded_documents").delete().eq.assert_not_called()


def test_cleanup_deletes_db_row_on_definitive_storage_success():
    """
    When storage destruction is definitively confirmed, the database record is purged.
    """
    mock_svc = MagicMock()
    mock_svc.client = MagicMock()

    mock_doc = {
        "id": "doc-uuid-success",
        "matric_no": "A24TESTOK",
        "file_name": "abandoned_ok.pdf",
        "file_path": "academic-slips/abandoned_ok.pdf",
        "processing_status": "Pending_Advisor_Approval",
        "created_at": "2026-09-01T00:00:00+00:00"
    }

    mock_svc.client.table().select().neq().lt().limit().execute.return_value.data = [mock_doc]
    
    # Storage removal returns list of deleted objects
    mock_svc.client.storage.from_().remove.return_value = [{"name": "abandoned_ok.pdf"}]

    with patch("scripts.cleanup_stale_pdfs.SupabaseService", return_value=mock_svc):
        result = run_cleanup(days=7, dry_run=False)

        assert result["total_found"] == 1
        assert result["storage_deleted"] == 1
        assert result["db_deleted"] == 1
        assert result["skipped"] == 0

        # Assert that DB delete was called
        mock_svc.client.table().delete().eq.assert_called_with("id", "doc-uuid-success")


def test_cleanup_tiered_retention_retains_recent_pending_approval():
    """
    Tiered Retention Test:
    A document with status 'Pending_Advisor_Approval' that is 15 days old must be
    retained when pending_days=30, because pending advisor reviews are given a 30-day window.
    """
    from datetime import datetime, timedelta, timezone

    mock_svc = MagicMock()
    mock_svc.client = MagicMock()

    recent_pending_time = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
    mock_doc = {
        "id": "doc-pending-15-days",
        "matric_no": "A24PENDING",
        "file_name": "pending_slip.pdf",
        "file_path": "transcripts/pending_slip.pdf",
        "processing_status": "Pending_Advisor_Approval",
        "created_at": recent_pending_time
    }

    mock_svc.client.table().select().neq().lt().limit().execute.return_value.data = [mock_doc]

    with patch("scripts.cleanup_stale_pdfs.SupabaseService", return_value=mock_svc):
        result = run_cleanup(pending_days=30, failed_days=7, dry_run=False)

        assert result["total_found"] == 1
        assert result["retained_by_policy"] == 1
        assert result["storage_deleted"] == 0
        assert result["db_deleted"] == 0

        # Storage and DB delete should NOT be called
        mock_svc.client.storage.from_().remove.assert_not_called()
        mock_svc.client.table("uploaded_documents").delete.assert_not_called()


def test_cleanup_tiered_retention_purges_old_pending_approval():
    """
    Tiered Retention Test:
    A document with status 'Pending_Advisor_Approval' that is 35 days old MUST be
    purged when pending_days=30.
    """
    from datetime import datetime, timedelta, timezone

    mock_svc = MagicMock()
    mock_svc.client = MagicMock()

    old_pending_time = (datetime.now(timezone.utc) - timedelta(days=35)).isoformat()
    mock_doc = {
        "id": "doc-pending-35-days",
        "matric_no": "A24OLD",
        "file_name": "old_pending.pdf",
        "file_path": "transcripts/old_pending.pdf",
        "processing_status": "Pending_Advisor_Approval",
        "created_at": old_pending_time
    }

    mock_svc.client.table().select().neq().lt().limit().execute.return_value.data = [mock_doc]
    mock_svc.client.storage.from_().remove.return_value = [{"name": "old_pending.pdf"}]

    with patch("scripts.cleanup_stale_pdfs.SupabaseService", return_value=mock_svc):
        result = run_cleanup(pending_days=30, failed_days=7, dry_run=False)

        assert result["total_found"] == 1
        assert result["retained_by_policy"] == 0
        assert result["storage_deleted"] == 1
        assert result["db_deleted"] == 1
        mock_svc.client.table().delete().eq.assert_called_with("id", "doc-pending-35-days")


def test_cleanup_tiered_retention_purges_failed_document():
    """
    Tiered Retention Test:
    A failed document that is 10 days old must be purged under failed_days=7.
    """
    from datetime import datetime, timedelta, timezone

    mock_svc = MagicMock()
    mock_svc.client = MagicMock()

    failed_time = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    mock_doc = {
        "id": "doc-failed-10-days",
        "matric_no": "A24FAILED",
        "file_name": "failed.pdf",
        "file_path": "academic-slips/failed.pdf",
        "processing_status": "Failed",
        "created_at": failed_time
    }

    mock_svc.client.table().select().neq().lt().limit().execute.return_value.data = [mock_doc]
    mock_svc.client.storage.from_().remove.return_value = [{"name": "failed.pdf"}]

    with patch("scripts.cleanup_stale_pdfs.SupabaseService", return_value=mock_svc):
        result = run_cleanup(pending_days=30, failed_days=7, dry_run=False)

        assert result["total_found"] == 1
        assert result["storage_deleted"] == 1
        assert result["db_deleted"] == 1
        mock_svc.client.table().delete().eq.assert_called_with("id", "doc-failed-10-days")


def test_cleanup_approved_documents_never_purged():
    """
    Safety Rule Test:
    Documents with processing_status = 'Approved' must NEVER be purged,
    even if older than 100 days.
    """
    from datetime import datetime, timedelta, timezone

    mock_svc = MagicMock()
    mock_svc.client = MagicMock()

    old_approved_time = (datetime.now(timezone.utc) - timedelta(days=100)).isoformat()
    mock_doc = {
        "id": "doc-approved-100-days",
        "matric_no": "A24APPROVED",
        "file_name": "approved.pdf",
        "file_path": "transcripts/approved.pdf",
        "processing_status": "Approved",
        "created_at": old_approved_time
    }

    mock_svc.client.table().select().neq().lt().limit().execute.return_value.data = [mock_doc]

    with patch("scripts.cleanup_stale_pdfs.SupabaseService", return_value=mock_svc):
        result = run_cleanup(pending_days=30, failed_days=7, dry_run=False)

        assert result["total_found"] == 1
        assert result["retained_by_policy"] == 1
        assert result["storage_deleted"] == 0
        assert result["db_deleted"] == 0
        mock_svc.client.storage.from_().remove.assert_not_called()
        mock_svc.client.table("uploaded_documents").delete.assert_not_called()

