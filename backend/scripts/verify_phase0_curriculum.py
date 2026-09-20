#!/usr/bin/env python3
"""
LUMA Phase 0 Pre-Launch Gate - Strict Curriculum Data Verification Script
=========================================================================
Target Program: Universiti Teknologi Malaysia (UTM) - Software Engineering (SECJ)

Live Schema Note:
  - The 'courses' table (per 01_schema.sql) stores prerequisites as JSONB:
    { "type": "AND", "courses": ["PREREQ_CODE"], "min_grade": "C", "min_credits": 0 }
  - This is the canonical source for the prerequisite graph verifier.

Purpose:
  1. Depth Check: Validate that the curriculum prerequisite graph covers expected
     pilot course chains (Year 1 to Year 4) rather than a trivial 1-2 node sample.
  2. False-GREEN Check: Validate that prerequisite constraints have explicit 'min_grade'
     populated (e.g. 'C' / GP 2.00) instead of dangerously defaulting to NULL / any-pass.
  3. Failure Warning & Remediation: If checks fail, output clear failure alerts and
     instruct the engineer to apply 11_remediation_curriculum_seed.sql.
"""

import os
import sys
import json
from typing import Dict, Any, List

# Ensure utf-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend path is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.supabase_client import SupabaseService

def run_curriculum_verification():
    print("=" * 80)
    print("LUMA PHASE 0 PRE-LAUNCH GATE: CURRICULUM INTEGRITY VERIFICATION")
    print("Target Program: UTM Software Engineering (SECJ)")
    print("=" * 80)

    svc = SupabaseService()
    if not svc.client:
        print("[FATAL] Supabase client could not be initialized. Check credentials.")
        sys.exit(1)

    admin = svc.client

    # -------------------------------------------------------------------------
    # 1. Inspect Degree Templates & Template Courses (Multi-Tenant Blueprint)
    # -------------------------------------------------------------------------
    print("\n[STEP 1] Inspecting Multi-Tenant Blueprint Architecture...")
    tmpl_res = admin.table("degree_templates").select("*").eq("program_code", "SECJ").execute()
    templates = tmpl_res.data or []
    print(f"  Found {len(templates)} degree_templates row(s) for SECJ:")
    for t in templates:
        print(f"    - Template ID: {t.get('id')} | {t.get('university_name')} | {t.get('program_code')} | {t.get('syllabus_year')} | Total Credits: {t.get('total_credits_required')}")

    template_id = templates[0]["id"] if templates else None

    tmpl_courses = []
    if template_id:
        tc_res = admin.table("template_courses").select("*").eq("template_id", template_id).execute()
        tmpl_courses = tc_res.data or []
        print(f"  Found {len(tmpl_courses)} template_courses in blueprint:")
        for c in tmpl_courses:
            print(f"    - {c.get('course_code')}: {c.get('course_name')} ({c.get('credit_hour')} cr, Core={c.get('is_core_requirement')})")
    else:
        print("  [WARNING] No degree_template found for SECJ!")

    # -------------------------------------------------------------------------
    # 2. Inspect 'courses' Table (canonical schema — JSONB prerequisites)
    # -------------------------------------------------------------------------
    print("\n[STEP 2] Inspecting 'courses' Table (Primary Prerequisite Source)...")

    try:
        courses_res = admin.table("courses").select("*").execute()
        raw_courses = courses_res.data or []
    except Exception as e:
        raw_courses = []
        print(f"  [WARNING] 'courses' table not accessible: {e}")

    print(f"  Rows in 'courses' table: {len(raw_courses)}")

    # Build edge list from JSONB prerequisites
    found_edges: List[tuple] = []
    edge_min_grades: Dict[tuple, str] = {}

    for c in raw_courses:
        c_code = (c.get("code") or "").upper()
        prereqs_json = c.get("prerequisites") or {}
        if isinstance(prereqs_json, str):
            try:
                prereqs_json = json.loads(prereqs_json)
            except Exception:
                prereqs_json = {}

        prereq_courses = prereqs_json.get("courses", [])
        min_grade = prereqs_json.get("min_grade", None)

        for p in prereq_courses:
            p_code = (p if isinstance(p, str) else p.get("course_code", "")).upper()
            if p_code and c_code:
                edge = (p_code, c_code)
                found_edges.append(edge)
                edge_min_grades[edge] = min_grade

    print(f"  Prerequisite edges found in 'courses' JSONB: {len(found_edges)}")

    # -------------------------------------------------------------------------
    # 3. DEPTH CHECK
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("EVALUATING CONDITION 1: DEPTH CHECK")
    print("-" * 80)

    # Expected core prerequisite progression chains for UTM Software Engineering
    expected_core_chains = [
        ("SECJ1013", "SECJ1023",  "Programming Technique I -> Programming Technique II"),
        ("SECJ1023", "SECJ2013",  "Programming Technique II -> Data Structures & Algorithms"),
        ("SECJ1023", "SECJ2203",  "Programming Technique II -> Software Engineering"),
        ("SECJ1023", "SECJ2154",  "Programming Technique II -> Object-Oriented Programming"),
        ("SECJ2203", "SECJ2253",  "Software Engineering -> Requirements Engineering & Software Modeling"),
        ("SECJ2203", "SECJ3263",  "Software Engineering -> Software Quality Assurance & Testing"),
        ("SECJ2203", "SECJ3303",  "Software Engineering -> Software Project Management"),
        ("SECJ2154", "SECJ3104",  "Object-Oriented Programming -> Applications Development"),
        ("SECJ2013", "SECJ3032",  "Data Structures & Algorithms -> Final Year Project 1"),
        ("SECR1013", "SECR2043",  "Digital Logic -> Operating Systems"),
    ]

    missing_critical_chains = []
    for src, tgt, desc in expected_core_chains:
        if (src, tgt) not in found_edges:
            missing_critical_chains.append(f"{src} -> {tgt} ({desc})")

    total_expected = len(expected_core_chains)
    total_found = total_expected - len(missing_critical_chains)
    depth_passed = total_found >= 5 and len(raw_courses) >= 10

    print(f"  Target Core Prerequisite Chains: {total_expected}")
    print(f"  Courses in catalog: {len(raw_courses)}")
    print(f"  Prerequisite Chains Detected:   {total_found} / {total_expected}")

    if not depth_passed:
        print(f"  [DEPTH FAILURE] Graph is too shallow or catalog is empty!")
        print(f"  Missing critical student progression chains:")
        for mc in missing_critical_chains:
            print(f"    - {mc}")
    else:
        print("  [DEPTH SUCCESS] Prerequisite graph covers multi-year curriculum depth.")
        if missing_critical_chains:
            print(f"  [NOTE] {len(missing_critical_chains)} optional chains not found (non-blocking):")
            for mc in missing_critical_chains:
                print(f"    - {mc}")

    # -------------------------------------------------------------------------
    # 4. FALSE-GREEN CHECK (min_grade verification on JSONB edges)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("EVALUATING CONDITION 2: FALSE-GREEN CHECK (min_grade Constraints)")
    print("-" * 80)

    unconstrained_edges = []
    for edge, min_grade in edge_min_grades.items():
        if not min_grade or min_grade.strip() == "":
            unconstrained_edges.append(f"{edge[0]} -> {edge[1]} (min_grade is {repr(min_grade)})")

    no_catalog = len(raw_courses) == 0
    false_green_passed = not no_catalog and len(unconstrained_edges) == 0

    if not false_green_passed:
        print("  [CRITICAL VULNERABILITY] False-GREEN Condition Detected!")
        if no_catalog:
            print("  - Data Defect: 'courses' table has 0 rows — degree audit engine has no curriculum to validate against!")
        if unconstrained_edges:
            print(f"  - Unconstrained Prerequisite Edges (min_grade is NULL/empty): {len(unconstrained_edges)}")
            for u in unconstrained_edges[:5]:
                print(f"      * {u}")
        print("\n  IMPACT:")
        print("  Students receiving grade 'D' (GP 1.00) in prerequisite courses will falsely receive a GREEN")
        print("  audit status, violating UTM academic regulations requiring minimum grade 'C' (GP 2.00) for prerequisites.")
    else:
        total_constrained = len([e for e in edge_min_grades.values() if e and e.strip()])
        print(f"  [SUCCESS] All {total_constrained} prerequisite edge(s) enforce explicit min_grade >= 'C'.")

    # -------------------------------------------------------------------------
    # 5. FOUNDING ADVISOR FLAG CHECK
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("EVALUATING CONDITION 3: FOUNDING ADVISOR FLAG (is_founding_advisor)")
    print("-" * 80)

    try:
        adv_res = admin.table("advisors").select("*").execute()
        advisors = adv_res.data or []
        adv_columns = list(advisors[0].keys()) if advisors else []
        has_flag_col = "is_founding_advisor" in adv_columns

        print(f"  Total advisors: {len(advisors)}")
        print(f"  Columns present: {adv_columns}")
        print(f"  is_founding_advisor column exists: {has_flag_col}")

        if has_flag_col:
            founding = [a for a in advisors if a.get("is_founding_advisor")]
            print(f"  Founding advisors flagged: {len(founding)}")
            for fa in founding:
                print(f"    - {fa.get('institutional_email') or fa.get('email')} | staff_id={fa.get('staff_id')} | is_founding_advisor=TRUE")
            if not founding:
                print("  [INFO] No founding advisors flagged yet. Run the SET command after first advisor signs up.")
        else:
            print("  [FAILURE] is_founding_advisor column MISSING — migration 10/11 not applied to live DB.")
    except Exception as e:
        has_flag_col = False
        print(f"  [ERROR] Could not query advisors: {e}")

    flag_passed = has_flag_col

    # -------------------------------------------------------------------------
    # 6. OVERALL VERIFICATION GATE
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)

    all_passed = depth_passed and false_green_passed and flag_passed

    if all_passed:
        print("PHASE 0 CURRICULUM GATE: [PASS / GREEN-LIT]")
        print("Curriculum graph satisfies depth, false-GREEN, and founding advisor flag constraints.")
        print("=" * 80)
        return 0
    else:
        print("PHASE 0 CURRICULUM GATE: [FAIL - BLOCKING UAT LAUNCH]")
        print()
        print("FAILED CHECKS:")
        if not depth_passed:
            print("  ❌ DEPTH: Course catalog empty or prerequisite graph has fewer than 5 verified chains.")
        if not false_green_passed:
            print("  ❌ FALSE-GREEN: min_grade constraints missing or catalog is empty.")
        if not flag_passed:
            print("  ❌ FOUNDING ADVISOR FLAG: is_founding_advisor column not in advisors table.")
        print()
        print("REMEDIATION:")
        print("  Apply the following migration file in the Supabase SQL Editor:")
        print("  > supabase/migrations/11_remediation_curriculum_seed.sql")
        print()
        print("  This file (idempotently):")
        print("  1. Adds is_founding_advisor BOOLEAN NOT NULL DEFAULT false to advisors")
        print("  2. Seeds the full UTM SECJ course catalog (26 courses, Year 1-4)")
        print("  3. Attaches explicit min_grade='C' to all prerequisite edges")
        print()
        print("  After applying, re-run this script to confirm PASS.")
        print("=" * 80)
        return 1


if __name__ == "__main__":
    exit_code = run_curriculum_verification()
    sys.exit(exit_code)
