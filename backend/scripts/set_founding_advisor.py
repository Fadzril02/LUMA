#!/usr/bin/env python3
"""
LUMA Phase 0 — Founding Advisor Flag Setter & Verifier
=======================================================
Founding Advisor: testing@utm.com (staff_id: TEST123)

PREREQUISITE: Migration 11 must be applied first in Supabase SQL Editor.
  File: supabase/migrations/11_remediation_curriculum_seed.sql

Usage:
  python backend/scripts/set_founding_advisor.py [--dry-run]

  --dry-run : Show BEFORE state without making any changes.
  (no flag)  : Apply is_founding_advisor = true and show BEFORE + AFTER.
"""
import sys
import os
import argparse

sys.stdout.reconfigure(encoding='utf-8')

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.supabase_client import SupabaseService

FOUNDING_ADVISOR_EMAIL = "testing@utm.com"
FOUNDING_ADVISOR_STAFF_ID = "TEST123"


def print_row(label: str, row: dict):
    print(f"\n  [{label}]")
    for k, v in row.items():
        print(f"    {k}: {v!r}")


def main(dry_run: bool):
    print("=" * 70)
    print("LUMA: Founding Advisor Flag Setter")
    print(f"Target: {FOUNDING_ADVISOR_EMAIL} (staff_id={FOUNDING_ADVISOR_STAFF_ID})")
    print("=" * 70)

    svc = SupabaseService()
    admin = svc.client

    # --- BEFORE ---
    before_res = admin.table("advisors").select("*").eq("institutional_email", FOUNDING_ADVISOR_EMAIL).execute()
    before_rows = before_res.data or []

    if not before_rows:
        print(f"\n[ABORT] No row found for email '{FOUNDING_ADVISOR_EMAIL}'.")
        print("  The advisor must sign up through the normal flow first.")
        print("  After signup, re-run this script to flip is_founding_advisor = true.")
        sys.exit(1)

    before = before_rows[0]
    print_row("BEFORE", before)

    # --- Validate flag column exists ---
    if "is_founding_advisor" not in before:
        print("\n[ABORT] 'is_founding_advisor' column does not exist in live advisors table.")
        print("  Apply supabase/migrations/11_remediation_curriculum_seed.sql first.")
        sys.exit(1)

    if before.get("is_founding_advisor") is True:
        print("\n[INFO] is_founding_advisor is already TRUE — no change needed.")
        sys.exit(0)

    if dry_run:
        print("\n[DRY RUN] Would set is_founding_advisor = true for this row.")
        print("Re-run without --dry-run to apply.")
        sys.exit(0)

    # --- APPLY ---
    update_res = admin.table("advisors") \
        .update({"is_founding_advisor": True}) \
        .eq("institutional_email", FOUNDING_ADVISOR_EMAIL) \
        .execute()

    # --- AFTER ---
    after_res = admin.table("advisors").select("*").eq("institutional_email", FOUNDING_ADVISOR_EMAIL).execute()
    after_rows = after_res.data or []

    if not after_rows:
        print("\n[ERROR] Could not read row after update. Check Supabase logs.")
        sys.exit(1)

    after = after_rows[0]
    print_row("AFTER", after)

    # --- Verify nothing else changed ---
    changed_fields = {k: (before.get(k), after.get(k)) for k in after if before.get(k) != after.get(k)}
    print(f"\n  Fields changed: {list(changed_fields.keys())}")

    if list(changed_fields.keys()) == ["is_founding_advisor"] and after.get("is_founding_advisor") is True:
        print("\n✅ SUCCESS: is_founding_advisor = true confirmed. Nothing else changed.")
        print("   This advisor now has permanently free, full access (Phase 1 UAT Pilot).")
    else:
        print(f"\n[WARNING] Unexpected field changes: {changed_fields}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Show BEFORE state without applying any changes")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
