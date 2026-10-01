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


def _pattern_wildcard_count(pattern: str) -> int:
    """Number of wildcard characters represented by runs of 2+ 'X' in pattern."""
    return sum(len(m.group()) for m in re.finditer(r'X{2,}', pattern.upper()))


def _slot_wildcard_count(patterns: List[str]) -> int:
    """Minimum wildcard count across patterns for a slot. Explicit codes have 0."""
    if not patterns:
        return 0
    return min(_pattern_wildcard_count(p) for p in patterns)


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
    template_total_credits: Optional[int] = None,
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
        template_total_credits: Optional total_credits_required from degree_templates.

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

    # Check template total credits warning if programme requirement provided
    template_row_credits_sum = sum(int(r.get("credit_hour") or r.get("credits") or 0) for r in template_rows)
    if template_total_credits is not None and template_row_credits_sum != int(template_total_credits):
        warnings.append(
            f"Template rows total {template_row_credits_sum} credits but programme requires {template_total_credits}."
        )

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

    # ------------------------------------------------------------------
    # Normalize overrides (supports DB row list or legacy/test dict)
    # ------------------------------------------------------------------
    assign_by_slot_id: Dict[str, Dict[str, Any]] = {}
    exclude_by_course_code: Dict[str, Dict[str, Any]] = {}

    if isinstance(overrides, dict):
        for k, v in overrides.items():
            if isinstance(v, dict):
                kind = v.get("kind", "assign")
                if kind == "assign":
                    slot_id = str(v.get("template_course_id") or k)
                    assign_by_slot_id[slot_id] = {
                        "kind": "assign",
                        "template_course_id": slot_id,
                        "course_code": str(v.get("course_code") or "").replace(" ", "").upper(),
                        "note": v.get("note"),
                        "assigned_by_staff_id": v.get("assigned_by_staff_id"),
                    }
                elif kind == "exclude":
                    code = str(v.get("course_code") or k).replace(" ", "").upper()
                    exclude_by_course_code[code] = {
                        "kind": "exclude",
                        "course_code": code,
                        "note": v.get("note"),
                        "assigned_by_staff_id": v.get("assigned_by_staff_id"),
                    }
            else:
                # Legacy {slot_id: course_code}
                assign_by_slot_id[str(k)] = {
                    "kind": "assign",
                    "template_course_id": str(k),
                    "course_code": str(v).replace(" ", "").upper(),
                    "note": None,
                    "assigned_by_staff_id": None,
                }
    elif isinstance(overrides, list):
        for item in overrides:
            if not isinstance(item, dict):
                continue
            kind = item.get("kind", "assign")
            if kind == "assign":
                slot_id = str(item.get("template_course_id") or "")
                if slot_id:
                    assign_by_slot_id[slot_id] = {
                        "kind": "assign",
                        "template_course_id": slot_id,
                        "course_code": str(item.get("course_code") or "").replace(" ", "").upper(),
                        "note": item.get("note"),
                        "assigned_by_staff_id": item.get("assigned_by_staff_id"),
                    }
            elif kind == "exclude":
                code = str(item.get("course_code") or "").replace(" ", "").upper()
                if code:
                    exclude_by_course_code[code] = {
                        "kind": "exclude",
                        "course_code": code,
                        "note": item.get("note"),
                        "assigned_by_staff_id": item.get("assigned_by_staff_id"),
                    }

    # Warn if an exclude override references a course not in passing records
    for exc_code, exc_info in exclude_by_course_code.items():
        if exc_code not in passing_codes:
            warnings.append(
                f"Exclude override for course '{exc_code}' is not a passing/counted attempt — ignoring."
            )

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
    # Step 2: Core rows — satisfied by exact course_code match
    # Excluded courses never auto-match any row.
    # ------------------------------------------------------------------
    for row in core_rows:
        tmpl_id = str(row.get("id") or "")
        tmpl_code = str(row.get("course_code") or "").replace(" ", "").upper()
        tmpl_name = row.get("course_name") or tmpl_code
        tmpl_credits = int(row.get("credit_hour") or row.get("credits") or 0)
        category = (row.get("category") or "Uncategorised")

        # Excluded courses never auto-match
        rec = unmatched_passing.get(tmpl_code) if (tmpl_code not in exclude_by_course_code) else None
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
                status="done", rec=rec, source="exact", override=None
            ))
        else:
            in_rec = in_progress_codes.get(tmpl_code) if (tmpl_code not in exclude_by_course_code) else None
            status = "in_progress" if in_rec else "missing"
            result_rows.append(_make_row(
                tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                is_slot=False, slot_no=None,
                status=status, rec=in_rec, source=None, override=None
            ))

    # ------------------------------------------------------------------
    # Step 3: Slot rows — Maximum Bipartite Matching (augmenting paths)
    # Assign overrides fill first; if stale/non-passing, ignore and auto-match.
    # ------------------------------------------------------------------
    resolved_slot_rows: Dict[str, Dict[str, Any]] = {}
    active_slot_rows: List[Dict[str, Any]] = []

    for row in slot_rows:
        tmpl_id = str(row.get("id") or "")
        tmpl_code = str(row.get("course_code") or "")
        tmpl_name = row.get("course_name") or tmpl_code
        tmpl_credits = int(row.get("credit_hour") or row.get("credits") or 0)
        category = (row.get("category") or "Uncategorised")
        slot_no = row.get("slot_no")

        if tmpl_id in assign_by_slot_id:
            ovr = assign_by_slot_id[tmpl_id]
            pinned_code = ovr["course_code"]
            rec = passing_codes.get(pinned_code)
            if not rec:
                # Stale override: no longer passing/counted attempt
                warnings.append(
                    f"Override for slot '{tmpl_code}' references '{pinned_code}' which is not a passing/counted attempt — ignoring override and auto-matching."
                )
                active_slot_rows.append(row)
            else:
                unmatched_passing.pop(pinned_code, None)
                rec_credits = int(rec.get("credits") or 0)
                slot_cr = rec_credits if rec_credits else tmpl_credits
                if rec_credits and tmpl_credits and rec_credits != tmpl_credits:
                    warnings.append(
                        f"Credit mismatch for slot override '{tmpl_code}' filled by '{pinned_code}': "
                        f"template={tmpl_credits}cr, record={rec_credits}cr. Using record credits."
                    )

                # Check pattern match
                pats = row.get("match_patterns") or []
                if not pats and row.get("course_code"):
                    pats = [p.strip() for p in str(row["course_code"]).split("/") if p.strip()]
                if pats and not _code_matches_any_pattern(pinned_code, pats):
                    warnings.append(
                        f"SLOT filled by advisor override outside its pattern: '{pinned_code}' assigned to '{tmpl_code}'."
                    )

                resolved_slot_rows[tmpl_id] = _make_row(
                    tmpl_id, tmpl_code, tmpl_name, category, slot_cr,
                    is_slot=True, slot_no=slot_no,
                    status="done", rec=rec, source="override",
                    override={
                        "kind": "assign",
                        "note": ovr.get("note"),
                        "assigned_by_staff_id": ovr.get("assigned_by_staff_id"),
                    }
                )
        else:
            active_slot_rows.append(row)

    # Normalize patterns for each active slot
    slot_patterns: Dict[str, List[str]] = {}
    for row in active_slot_rows:
        tmpl_id = str(row.get("id") or "")
        pats = row.get("match_patterns") or []
        if not pats and row.get("course_code"):
            pats = [p.strip() for p in str(row["course_code"]).split("/") if p.strip()]
        slot_patterns[tmpl_id] = pats

    # Build candidates for each slot, ordered by pattern specificity (fewest wildcards first)
    # Excluded courses never auto-match any slot
    available_codes = [c for c in unmatched_passing.keys() if c not in exclude_by_course_code]
    slot_candidates: Dict[str, List[str]] = {}
    for row in active_slot_rows:
        tmpl_id = str(row.get("id") or "")
        pats = slot_patterns[tmpl_id]
        matching = []
        for code in available_codes:
            valid_pats = [p for p in pats if _code_matches_pattern(code, p)]
            if valid_pats:
                min_wild = min(_pattern_wildcard_count(p) for p in valid_pats)
                matching.append((min_wild, code))
        matching.sort(key=lambda item: (item[0], item[1]))
        slot_candidates[tmpl_id] = [c for _, c in matching]

    # Sort active slots: prefer specific slots (fewer wildcard characters / explicit codes), tie-break by slot_no
    sorted_active_slots = sorted(
        active_slot_rows,
        key=lambda r: (
            _slot_wildcard_count(slot_patterns[str(r.get("id") or "")]),
            r.get("slot_no") or 0
        )
    )

    # Augmenting path matching
    slot_match: Dict[str, str] = {}
    code_match: Dict[str, str] = {}

    def dfs(s_id: str, visited_courses: set) -> bool:
        for c_code in slot_candidates[s_id]:
            if c_code in visited_courses:
                continue
            visited_courses.add(c_code)
            curr_slot = code_match.get(c_code)
            if curr_slot is None or dfs(curr_slot, visited_courses):
                slot_match[s_id] = c_code
                code_match[c_code] = s_id
                return True
        return False

    for s_row in sorted_active_slots:
        s_id = str(s_row.get("id") or "")
        visited: set = set()
        dfs(s_id, visited)

    # Consume matched courses from unmatched_passing
    for s_id, c_code in slot_match.items():
        unmatched_passing.pop(c_code, None)

    # Build final row objects in original slot_no order
    for row in slot_rows:
        tmpl_id = str(row.get("id") or "")
        if tmpl_id in resolved_slot_rows:
            result_rows.append(resolved_slot_rows[tmpl_id])
            continue

        tmpl_code = str(row.get("course_code") or "")
        tmpl_name = row.get("course_name") or tmpl_code
        tmpl_credits = int(row.get("credit_hour") or row.get("credits") or 0)
        category = (row.get("category") or "Uncategorised")
        slot_no = row.get("slot_no")
        pats = slot_patterns.get(tmpl_id, [])

        if tmpl_id in slot_match:
            matched_code = slot_match[tmpl_id]
            matched_rec = passing_codes[matched_code]
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
                status="done", rec=matched_rec, source="pattern", override=None
            ))
        else:
            in_rec = None
            for code, rec in in_progress_codes.items():
                if code not in exclude_by_course_code and _code_matches_any_pattern(code, pats):
                    in_rec = rec
                    break
            status = "in_progress" if in_rec else "missing"
            result_rows.append(_make_row(
                tmpl_id, tmpl_code, tmpl_name, category, tmpl_credits,
                is_slot=True, slot_no=slot_no,
                status=status, rec=in_rec, source=None, override=None
            ))

    # ------------------------------------------------------------------
    # Unassigned: passing codes that filled no template row.
    # Excluded courses are listed here with excluded: true and override info.
    # ------------------------------------------------------------------
    unassigned = []
    for code, rec in unmatched_passing.items():
        is_excluded = code in exclude_by_course_code and code in passing_codes
        ovr = exclude_by_course_code.get(code) if is_excluded else None
        unassigned.append({
            "course_code": code,
            "course_name": rec.get("course_name") or code,
            "grade": rec.get("grade"),
            "credits": int(rec.get("credits") or 0),
            "semester": rec.get("semester"),
            "excluded": is_excluded,
            "override": {
                "kind": "exclude",
                "note": ovr.get("note"),
                "assigned_by_staff_id": ovr.get("assigned_by_staff_id"),
            } if ovr else None,
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
    override: Optional[Dict[str, Any]] = None,
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
        "override": override,
    }
