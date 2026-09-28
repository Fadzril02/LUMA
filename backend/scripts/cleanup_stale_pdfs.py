"""
Smart Academic Assessment System - PDPA Stale File & Abandoned Document Cleanup Script

Regulatory Context (Malaysia Personal Data Protection Act 2010 - PDPA):
Under the Retention Principle (Section 10 of PDPA 2010), personal data shall not be
kept longer than is necessary for the fulfillment of the purpose for which it was
collected. Unapproved, rejected, or abandoned academic transcripts and slips pose a
significant compliance risk if left orphaned in storage buckets.

Action:
1. Queries 'uploaded_documents' where processing_status != 'Approved'
   AND created_at < NOW() - INTERVAL '7 days'.
2. Iterates through records, deletes the physical PDF from Supabase Storage
   ('academic-slips' / 'transcripts').
3. Strict Safety Constraint: Database records are ONLY deleted if the Supabase Storage
   API returns definitive success for the physical file destruction. If storage deletion
   fails or times out, the database row is skipped to prevent orphaned files.
4. Logs each action with granular audit trails and metrics.

Usage:
    python backend/scripts/cleanup_stale_pdfs.py
    python backend/scripts/cleanup_stale_pdfs.py --dry-run
    python backend/scripts/cleanup_stale_pdfs.py --days 7 --batch-size 100
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [PDPA-CLEANUP] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("pdpa_stale_cleanup")

try:
    from app.core.supabase_client import SupabaseService
except ImportError:
    from backend.app.core.supabase_client import SupabaseService


def parse_args():
    parser = argparse.ArgumentParser(
        description="PDPA Maintenance: Purge unapproved academic PDF transcripts under tiered retention."
    )
    parser.add_argument(
        "--pending-days",
        type=int,
        default=30,
        help="Retention threshold in days for documents in pending review status (default: 30 days)"
    )
    parser.add_argument(
        "--failed-days",
        type=int,
        default=7,
        help="Retention threshold in days for failed, rejected, error, or unapproved draft documents (default: 7 days)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Legacy retention threshold in days (if provided, overrides both pending and failed days)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate cleanup without deleting storage files or database records"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Maximum records to process per run (default: 100)"
    )
    return parser.parse_args()


def fetch_stale_documents(
    svc: SupabaseService,
    cutoff_iso: str,
    batch_size: int = 100
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Queries 'uploaded_documents' where processing_status != 'Approved'
    and created_at < cutoff.
    Gracefully handles both 'created_at' and 'uploaded_at' column naming.
    """
    client = svc.client
    if not client:
        raise RuntimeError("Supabase client is not initialized. Check your credentials.")

    timestamp_col = "created_at"
    try:
        res = (
            client.table("uploaded_documents")
            .select("id, matric_no, file_name, file_path, processing_status, created_at")
            .neq("processing_status", "Approved")
            .lt("created_at", cutoff_iso)
            .limit(batch_size)
            .execute()
        )
        return res.data or [], timestamp_col
    except Exception as e:
        err_msg = str(e).lower()
        if "created_at" in err_msg and ("does not exist" in err_msg or "42703" in err_msg):
            logger.info("Column 'created_at' not found on 'uploaded_documents'; querying 'uploaded_at' instead.")
            timestamp_col = "uploaded_at"
            res = (
                client.table("uploaded_documents")
                .select("id, matric_no, file_name, file_path, processing_status, uploaded_at")
                .neq("processing_status", "Approved")
                .lt("uploaded_at", cutoff_iso)
                .limit(batch_size)
                .execute()
            )
            return res.data or [], timestamp_col
        raise


def delete_storage_file_with_confirmation(svc: SupabaseService, file_path: str) -> bool:
    """
    Deletes the physical PDF file from the designated Supabase bucket and strictly validates
    that the Supabase Storage API returns a definitive success response.

    Returns:
        True  - physical destruction was definitively confirmed by the storage API
                or the file is confirmed non-existent in storage.
        False - removal failed, timed out, or returned an unconfirmed/error status.
    """
    if not file_path or file_path in {"[PURGED]", ""}:
        logger.info("  [STORAGE CONFIRMED] File path '%s' is already flagged as purged or empty.", file_path)
        return True

    clean_path = (
        file_path
        .removeprefix("transcripts/")
        .removeprefix("academic-slips/")
        .removeprefix("/")
    )
    bucket = "academic-slips" if "academic-slips" in file_path else "transcripts"
    alt_bucket = "transcripts" if bucket == "academic-slips" else "academic-slips"

    # Attempt removal from primary bucket
    try:
        res = svc.client.storage.from_(bucket).remove([clean_path])
        if isinstance(res, list) and len(res) > 0:
            logger.info("  [STORAGE CONFIRMED] Definitively destroyed '%s' in bucket '%s'.", clean_path, bucket)
            return True
        elif isinstance(res, list) and len(res) == 0:
            # Check alternative bucket in case file was stored there
            alt_res = svc.client.storage.from_(alt_bucket).remove([clean_path])
            if isinstance(alt_res, list) and len(alt_res) > 0:
                logger.info("  [STORAGE CONFIRMED] Definitively destroyed '%s' in fallback bucket '%s'.", clean_path, alt_bucket)
                return True

            # If not found in either bucket, verify absence by attempting download
            try:
                svc.client.storage.from_(bucket).download(clean_path)
                logger.error("  [STORAGE UNCONFIRMED] File '%s' still downloadable in bucket '%s'.", clean_path, bucket)
                return False
            except Exception:
                # File is confirmed absent from storage
                logger.info("  [STORAGE CONFIRMED] File '%s' is confirmed absent from storage.", clean_path)
                return True
        elif isinstance(res, dict) and res.get("error"):
            logger.error("  [STORAGE FAILED] Storage API error response for '%s': %s", clean_path, res.get("error"))
            return False
        else:
            logger.warning("  [STORAGE UNCONFIRMED] Unexpected response type from Storage API: %s", type(res))
            return False
    except Exception as e:
        logger.error("  [STORAGE TIMEOUT / EXCEPTION] Deletion failed for '%s': %s", clean_path, e)
        return False


PENDING_STATUS_SET = {
    "pending_advisor_approval",
    "pending_verification",
    "pending_student_verification",
    "pending",
    "pending_approval",
    "under_review",
    "needs_review"
}


def is_document_stale(
    doc: Dict[str, Any],
    time_col: str,
    pending_cutoff_dt: datetime,
    failed_cutoff_dt: datetime
) -> Tuple[bool, str]:
    """
    Evaluates whether an uploaded document record is eligible for PDPA cleanup under tiered retention.
    - Records with processing_status = 'Approved' must NEVER be purged.
    - Records with processing_status in PENDING_STATUS_SET (or starting with 'pending') are retained for pending_days (default: 30 days).
    - Records with processing_status in ('Failed', 'Rejected', 'Error', 'Uploaded') or other unapproved
      abandoned drafts are retained for failed_days (default: 7 days).
    """
    raw_status = (doc.get("processing_status") or "").strip()
    status_lower = raw_status.lower()

    # Rule: Records with processing_status = 'Approved' must NEVER be purged
    if status_lower == "approved":
        return False, "Exempt from purge: processing_status is 'Approved'"

    raw_ts = doc.get(time_col)
    if not raw_ts:
        return True, "Eligible: missing timestamp on unapproved document"

    try:
        ts_str = str(raw_ts).replace("Z", "+00:00")
        doc_dt = datetime.fromisoformat(ts_str)
        if doc_dt.tzinfo is None:
            doc_dt = doc_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return True, f"Eligible: invalid timestamp format '{raw_ts}' on unapproved document"

    is_pending_review = (
        status_lower in PENDING_STATUS_SET
        or status_lower.startswith("pending")
    )

    if is_pending_review:
        if doc_dt < pending_cutoff_dt:
            return True, f"Eligible: pending review document older than pending threshold ({pending_cutoff_dt.isoformat()})"
        return False, f"Retained: pending review document within pending retention threshold ({pending_cutoff_dt.isoformat()})"
    else:
        # Failed, Rejected, Error, Uploaded, or unapproved abandoned drafts
        if doc_dt < failed_cutoff_dt:
            return True, f"Eligible: failed/abandoned document older than failed threshold ({failed_cutoff_dt.isoformat()})"
        return False, f"Retained: failed/abandoned document within failed retention threshold ({failed_cutoff_dt.isoformat()})"


def run_cleanup(
    pending_days: int = 30,
    failed_days: int = 7,
    dry_run: bool = False,
    batch_size: int = 100,
    days: Optional[int] = None
) -> Dict[str, Any]:
    # Support backwards compatibility with legacy `days` argument
    if days is not None:
        pending_days = days
        failed_days = days

    start_time = datetime.now(timezone.utc)
    pending_cutoff_dt = start_time - timedelta(days=pending_days)
    failed_cutoff_dt = start_time - timedelta(days=failed_days)

    pending_cutoff_iso = pending_cutoff_dt.isoformat()
    failed_cutoff_iso = failed_cutoff_dt.isoformat()
    # Query using the more recent cutoff threshold so any document older than either limit is retrieved
    query_cutoff_iso = max(pending_cutoff_dt, failed_cutoff_dt).isoformat()

    logger.info("=" * 70)
    logger.info("PDPA Stale Document Cleanup Initiated (Tiered Retention)")
    logger.info("Pending Review Retention: %d days (Cutoff: %s)", pending_days, pending_cutoff_iso)
    logger.info("Failed/Draft Retention  : %d days (Cutoff: %s)", failed_days, failed_cutoff_iso)
    logger.info("Execution Mode          : %s", "DRY-RUN (Simulated)" if dry_run else "LIVE PURGE")
    logger.info("Batch Limit             : %d records", batch_size)
    logger.info("=" * 70)

    svc = SupabaseService()
    if not svc.client:
        logger.error("SupabaseService client is unavailable. Aborting cleanup.")
        return {"success": False, "error": "Client unavailable"}

    try:
        stale_docs, time_col = fetch_stale_documents(svc, query_cutoff_iso, batch_size=batch_size)
    except Exception as e:
        logger.error("Error querying stale documents from 'uploaded_documents': %s", e)
        return {"success": False, "error": str(e)}

    total_found = len(stale_docs)
    logger.info("Identified %d candidate document(s) matching initial query criteria.", total_found)

    deleted_storage_count = 0
    deleted_db_count = 0
    skipped_count = 0
    retained_count = 0
    errors_count = 0

    for idx, doc in enumerate(stale_docs, 1):
        doc_id = doc.get("id")
        file_path = doc.get("file_path") or ""
        matric_no = doc.get("matric_no") or "N/A"
        status_val = doc.get("processing_status") or "Unknown"
        created_time = doc.get(time_col) or "Unknown"

        logger.info(
            "[%d/%d] Inspecting Doc ID: %s | Matric: %s | Status: %s | Timestamp: %s | Path: %s",
            idx, total_found, doc_id, matric_no, status_val, created_time, file_path
        )

        is_stale, reason = is_document_stale(
            doc=doc,
            time_col=time_col,
            pending_cutoff_dt=pending_cutoff_dt,
            failed_cutoff_dt=failed_cutoff_dt
        )

        if not is_stale:
            retained_count += 1
            logger.info("  [RETENTION SAFE] %s. Preserving document row '%s'.", reason, doc_id)
            continue

        if dry_run:
            logger.info("  [DRY-RUN] Would delete physical file '%s' and remove document row '%s'.", file_path, doc_id)
            continue

        # CRITICAL CONSTRAINT:
        # Physical file destruction must be definitively confirmed before database deletion.
        # If storage destruction fails, times out, or cannot be confirmed, SKIP database
        # deletion to prevent creating orphaned files in the storage bucket.
        storage_success = False
        try:
            storage_success = delete_storage_file_with_confirmation(svc, file_path)
        except Exception as e:
            logger.error("  [STORAGE ERROR] Exception during physical file destruction: %s", e)
            storage_success = False

        if not storage_success:
            skipped_count += 1
            logger.warning(
                "  [DB DELETION BLOCKED] Storage API did NOT confirm destruction of '%s'. "
                "Skipping DB deletion for document '%s' to prevent orphaned files.",
                file_path, doc_id
            )
            continue

        deleted_storage_count += 1

        # Database record deletion only executed after storage API confirmation
        try:
            svc.client.table("uploaded_documents").delete().eq("id", doc_id).execute()
            deleted_db_count += 1
            logger.info("  [DB ROW DELETED] Document record '%s' purged from database.", doc_id)
        except Exception as db_err:
            errors_count += 1
            logger.error("  [DB DELETE FAILED] Failed to delete document row '%s': %s", doc_id, db_err)

    duration = (datetime.now(timezone.utc) - start_time).total_seconds()

    logger.info("=" * 70)
    logger.info("PDPA Stale Document Cleanup Completed in %.2f seconds", duration)
    logger.info("Total Candidates     : %d", total_found)
    logger.info("Retained by Policy   : %d", retained_count)
    if not dry_run:
        logger.info("Storage Files Purged : %d", deleted_storage_count)
        logger.info("Database Rows Purged : %d", deleted_db_count)
        logger.info("Skipped (Safety Gate): %d", skipped_count)
        logger.info("Errors Encountered   : %d", errors_count)
    else:
        logger.info("Simulation Complete  : 0 items changed (dry-run).")
    logger.info("=" * 70)

    return {
        "success": True,
        "dry_run": dry_run,
        "total_found": total_found,
        "retained_by_policy": retained_count,
        "storage_deleted": deleted_storage_count,
        "db_deleted": deleted_db_count,
        "skipped": skipped_count,
        "errors": errors_count,
        "duration_seconds": duration
    }


def main():
    args = parse_args()
    result = run_cleanup(
        pending_days=args.pending_days,
        failed_days=args.failed_days,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        days=args.days
    )
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    main()
