"""
SynGrad Requirement Matching Engine (4A)

Pure function — no DB access, no hardcoded university logic.
compute_progress(template_rows, records, scale, repeat_policy, overrides) -> dict
"""

import re
from typing import Any, Dict, List, Optional

try:
    from app.engine.grading import GradingScale, select_attempts_by_repeat_policy
except ImportError:
    from backend.app.engine.grading import GradingScale, select_attempts_by_repeat_policy


# ---------------------------------------------------------------------------
# Pattern matching helpers
# ---------------------------------------------------------------------------

def _build_pattern_regex(pattern: str) -> re.Pattern:
    """
    Convert a template slot pattern (e.g. 'SCSRXXX3') to a compiled regex
    that prefix-matches a course code.

    Rule (from spec + csv_course_parser):
      - A contiguous run of 2 or more 'X' characters → that many [A-Z0-9] chars
      - A single 'X' is treated as a literal (no wildcard for lone X chars, to
        avoid false matches on codes that happen to contain one X)
    The resulting regex is anchored at the START (prefix match, not full match).
    """
    part = pattern.upper()
    # Replace runs of 2+ X with equivalent [A-Z0-9]{n}
    regex_str = re.sub(r'X{2,}', lambda m: f'[A-Z0-9]{{{len(m.group())}}}', part)
    return re.compile(r'^' + regex_str)


def _code_matches_pattern(course_code: str, pattern: str) -> bool:
    """Return True if course_code prefix-matches the slot pattern."""
    try:
        rx = _build_pattern_regex(pattern)
        return bool(rx.match(course_code.upper()))
    except re.error:
        return False


def _code_matches_any_pattern(course_code: str, patterns: Optional[List[str]]) -> bool:
    if not patterns:
        return False
    return any(_code_matches_pattern(course_code, p) for p in patterns)


# ---------------------------------------------------------------------------
# Main function
# ---------------------------------------------------------------------------

def compute_progress(
    template_rows: List[Dict[str, Any]],
    records: List[Dict[str, Any]],
    scale: GradingScale,
    repeat_policy: str = "latest",
    overrides: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Match academic records against a degree template and compute progress.

    Args:
        template_rows: Rows from template_courses (dicts with keys:
                       id, course_code, course_name, credit_hour, category,
                       is_elective_slot, slot_no, match_patterns, ...)
        records: Rows from academic_records (dicts with keys:
                 course_code, grade, credits, semester, status)
        scale: Tenant GradingScale instance.
        repeat_policy: 'latest' or 'best'.
        overrides: {template_course_id (str) -> course_code (str)} mapping.
                   Overrides are applied before any auto-matching.

    Returns:
        {
          rows: [{template_course_id, code, name, category, credits (template),
                  is_slot, slot_no, status, satisfied_by, source}],
          categories: [{category, required, earned}],
          unassigned: [records that were not matched to any template row],
          totals: {required, earned},
          warnings: [...],
        }
    """
    if overrides is None:
        overrides = {}

    warnings: List[str] = []

    # ------------------------------------------------------------------
    # 1. Apply repeat policy to raw records → one row per course_code
    # ------------------------------------------------------------------
    selected_records = select_attempts_by_repeat_policy(records, scale, repeat_policy)

    # Build lookup: course_code (upper) -> record dict
    record_by_code: Dict[str, Dict[str, Any]] = {}
    for rec in selected_records:
        code = str(rec.get("course_code") or "").replace(" ", "").upper()
        if code:
            record_by_code[code] = rec

    # Filter to passing records only (counts_as_completed in scale)
    passing_codes: Dict[str, Dict[str, Any]] = {}
    in_progress_codes: Dict[str, Dict[str, Any]] = {}

    for code, rec in record_by_code.items():
        grade = str(rec.get("grade") or "").strip().upper()
        if not grade:
            # Status-only record (no grade yet) — treat as in-progress if status says so
            st = str(rec.get("status") or "").lower()
            if "progress" in st:
                in_progress_codes[code] = rec
            continue
        try:
            if scale.counts_as_completed(grade, code):
                passing_codes[code] = rec
            elif scale.is_pass(grade, code):
                # Passes but not "completed" (e.g. TD/TS/in-progress special codes)
                in_progress_codes[code] = rec
            else:
                # Failed attempt chosen by repeat policy — still not passing
                pass
        except ValueError:
            # Unknown grade — warn and skip
            warnings.append(f"Unknown grade '{grade}' for course '{code}' — skipped in progress computation.")

    # Track which passing codes are still available for matching
    unmatched_passing = dict(passing_codes)  # mutable copy

    # ------------------------------------------------------------------
    # Separate template rows into core and slot buckets
    # ------------------------------------------------------------------
    core_rows = [r for r in template_rows if not r.get("is_elective_slot")]
    slot_rows = sorted(
        [r for r in template_rows if r.get("is_elective_slot")],
        key=lambda r: (r.get("slot_no") or 0)
    )

    result_rows: List[Dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Step 1 (overrides first): for any template_course_id in overrides,
    #   pin the specified course_code to that row regardless of pattern.
    # ------------------------------------------------------------------
    # We do this by pre-consuming those codes from unmatched_passing.
    override_by_tmpl_id: Dict[str, str] = {
        str(k): str(v).replace(" ", "").upper()
        for k, v in overrides.items()
        if v
    }

    # ------------------------------------------------------------------
    # Step 2: Core rows — satisfied by exact course_code match
    # ------------------------------------------------------------------
    for row in core_rows:
        tmpl_id = str(row.get("id") or "")
        tmpl_code = str(row.get("course_code") or "").replace(" ", "").upper()
        tmpl_name = row.get("course_name") or tmpl_code
        tmpl_credits = int(row.get("credit_hour") or 0)
        category = row.get("category") or "Core"

        # Override takes precedence
        if tmpl_id in override_by_tmpl_id:
            pinned_code = override_by_tmpl_id[tmpl_id]
            rec = passing_codes.get(pinned_code)
            if rec:
                unmatched_passing.pop(pinned_code, None)
                rec_credits = int(rec.get("credits") or 0)
                if rec_credits and rec_credits != tmpl_credits:
                    warnings.append(
                        f"Credit mismatch for override on '{tmpl_code}': template={tmpl_credits}cr, "
                        f"record '{pinned_code}'={rec_credits}cr. Using template credits."
                    )
                result_rows.append(_make_row(
                    tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                    is_slot=False, slot_no=None,
                    status="done", rec=rec, source="override"
                ))
            else:
                in_rec = in_progress_codes.get(pinned_code)
                status = "in_progress" if in_rec else "missing"
                result_rows.append(_make_row(
                    tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                    is_slot=False, slot_no=None,
                    status=status, rec=in_rec, source="override"
                ))
            continue

        # Exact match
        rec = unmatched_passing.get(tmpl_code)
        if rec:
            unmatched_passing.pop(tmpl_code)
            rec_credits = int(rec.get("credits") or 0)
            if rec_credits and rec_credits != tmpl_credits:
                warnings.append(
                    f"Credit mismatch for '{tmpl_code}': template={tmpl_credits}cr, "
                    f"record={rec_credits}cr. Using template credits."
                )
            result_rows.append(_make_row(
                tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                is_slot=False, slot_no=None,
                status="done", rec=rec, source="exact"
            ))
        else:
            # Check in-progress
            in_rec = in_progress_codes.get(tmpl_code)
            status = "in_progress" if in_rec else "missing"
            result_rows.append(_make_row(
                tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                is_slot=False, slot_no=None,
                status=status, rec=in_rec, source=None
            ))

    # ------------------------------------------------------------------
    # Step 3: Slot rows — greedy assign from remaining passing codes
    # ------------------------------------------------------------------
    for row in slot_rows:
        tmpl_id = str(row.get("id") or "")
        tmpl_code = str(row.get("course_code") or "")  # e.g. "SCSRXXX3/SCSTXXX3"
        tmpl_name = row.get("course_name") or tmpl_code
        tmpl_credits = int(row.get("credit_hour") or 0)
        category = row.get("category") or "Elective"
        slot_no = row.get("slot_no")
        patterns = row.get("match_patterns") or []

        # Override takes precedence
        if tmpl_id in override_by_tmpl_id:
            pinned_code = override_by_tmpl_id[tmpl_id]
            rec = passing_codes.get(pinned_code)
            if rec:
                unmatched_passing.pop(pinned_code, None)
                rec_credits = int(rec.get("credits") or 0)
                if rec_credits and rec_credits != tmpl_credits:
                    warnings.append(
                        f"Credit mismatch for slot override '{tmpl_code}' filled by '{pinned_code}': "
                        f"template={tmpl_credits}cr, record={rec_credits}cr. Using record credits."
                    )
                    tmpl_credits = rec_credits
                result_rows.append(_make_row(
                    tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                    is_slot=True, slot_no=slot_no,
                    status="done", rec=rec, source="override"
                ))
            else:
                in_rec = in_progress_codes.get(pinned_code)
                status = "in_progress" if in_rec else "missing"
                result_rows.append(_make_row(
                    tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                    is_slot=True, slot_no=slot_no,
                    status=status, rec=in_rec, source="override"
                ))
            continue

        # Greedy: find first unmatched passing code that matches any pattern
        matched_code = None
        matched_rec = None
        for code in list(unmatched_passing.keys()):
            if _code_matches_any_pattern(code, patterns):
                matched_code = code
                matched_rec = unmatched_passing.pop(code)
                break

        if matched_rec is not None:
            rec_credits = int(matched_rec.get("credits") or 0)
            slot_cr = rec_credits if rec_credits else tmpl_credits
            if rec_credits and tmpl_credits and rec_credits != tmpl_credits:
                warnings.append(
                    f"Credit mismatch for slot '{tmpl_code}' filled by '{matched_code}': "
                    f"template={tmpl_credits}cr, record={rec_credits}cr. Using record credits."
                )
            result_rows.append(_make_row(
                tmpl_id, tmpl_code, tmpl_name, category, slot_cr,
                is_slot=True, slot_no=slot_no,
                status="done", rec=matched_rec, source="pattern"
            ))
        else:
            # Check in-progress among codes matching any pattern
            in_rec = None
            for code, rec in in_progress_codes.items():
                if _code_matches_any_pattern(code, patterns):
                    in_rec = rec
                    break
            status = "in_progress" if in_rec else "missing"
            result_rows.append(_make_row(
                tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                is_slot=True, slot_no=slot_no,
                status=status, rec=in_rec, source=None
            ))

    # ------------------------------------------------------------------
    # Unassigned: passing codes that filled no template row
    # ------------------------------------------------------------------
    unassigned = []
    for code, rec in unmatched_passing.items():
        unassigned.append({
            "course_code": code,
            "course_name": rec.get("course_name") or code,
            "grade": rec.get("grade"),
            "credits": int(rec.get("credits") or 0),
            "semester": rec.get("semester"),
        })

    # ------------------------------------------------------------------
    # Categories: group by category; required = sum of template credits;
    # earned = sum of credits from satisfied rows
    # ------------------------------------------------------------------
    cat_required: Dict[str, int] = {}
    cat_earned: Dict[str, int] = {}
    for r in result_rows:
        cat = r["category"]
        tmpl_cr = r["credits"]  # template credits (or record credits for slots)
        cat_required[cat] = cat_required.get(cat, 0) + tmpl_cr
        if r["status"] == "done":
            cat_earned[cat] = cat_earned.get(cat, 0) + tmpl_cr

    categories = [
        {
            "category": cat,
            "required": cat_required[cat],
            "earned": cat_earned.get(cat, 0),
        }
        for cat in cat_required
    ]

    total_required = sum(c["required"] for c in categories)
    total_earned = sum(c["earned"] for c in categories)

    return {
        "rows": result_rows,
        "categories": categories,
        "unassigned": unassigned,
        "totals": {"required": total_required, "earned": total_earned},
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_row(
    tmpl_id: str,
    code: str,
    name: str,
    category: str,
    credits: int,
    *,
    is_slot: bool,
    slot_no: Optional[int],
    status: str,
    rec: Optional[Dict[str, Any]],
    source: Optional[str],
) -> Dict[str, Any]:
    satisfied_by = None
    if rec is not None and status in ("done", "in_progress"):
        satisfied_by = {
            "course_code": str(rec.get("course_code") or "").replace(" ", "").upper(),
            "grade": rec.get("grade"),
            "semester": rec.get("semester"),
        }
    return {
        "template_course_id": tmpl_id,
        "code": code,
        "name": name,
        "category": category,
        "credits": credits,
        "is_slot": is_slot,
        "slot_no": slot_no,
        "status": status,
        "satisfied_by": satisfied_by,
        "source": source,
    }
