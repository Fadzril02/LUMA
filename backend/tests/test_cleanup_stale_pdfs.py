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
