"""
Smart Academic Assessment System - CLI Document Purge Utility
Usage:
    python scripts/purge_document.py --doc-id <UUID>
    python scripts/purge_document.py --matric <MATRIC_NO>
"""

import os
import sys
import argparse
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

try:
    from app.core.supabase_client import SupabaseService
except ImportError:
    from backend.app.core.supabase_client import SupabaseService


def main():
    parser = argparse.ArgumentParser(description="Manual Purge of Transcript PDF from Storage after Advisor Approval")
    parser.add_argument("--doc-id", dest="doc_id", help="Document UUID in uploaded_documents table", default=None)
    parser.add_argument("--matric", dest="matric", help="Student matric number", default=None)
    parser.add_argument("--admin", dest="admin", help="Admin staff ID triggering the purge", default="ADMIN-CLI")

    args = parser.parse_args()

    if not args.doc_id and not args.matric:
        print("[ERROR] Please provide either --doc-id <UUID> or --matric <MATRIC_NO>")
        sys.exit(1)

    svc = SupabaseService()
    print(f"[*] Initiating purge request for doc_id='{args.doc_id}', matric='{args.matric}'...")

    try:
        result = svc.purge_uploaded_document_file(
            document_id=args.doc_id,
            matric_no=args.matric,
            admin_staff_id=args.admin
        )
        print("\n[SUCCESS] Purge Operation Completed:")
        print(f"  - Document ID: {result.get('document_id')}")
        print(f"  - Purged Storage Path: {result.get('purged_file_path')}")
        print(f"  - Storage Deleted: {result.get('storage_deleted')}")
        print(f"  - Processing Status: {result.get('processing_status')}")
        print(f"  - Message: {result.get('message')}")
    except PermissionError as pe:
        print(f"\n[BLOCKED / PERMISSION ERROR] {pe}")
        sys.exit(2)
    except Exception as e:
        print(f"\n[FAILED] Error during purge: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
