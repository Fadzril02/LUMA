#!/usr/bin/env python3
"""
Check founding advisor status and advisors table columns.
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.supabase_client import SupabaseService

svc = SupabaseService()
admin = svc.client

print("=" * 70)
print("ADVISORS TABLE — FULL AUDIT")
print("=" * 70)

res = admin.table("advisors").select("*").execute()
rows = res.data or []
print(f"Total rows: {len(rows)}")

if rows:
    print(f"Columns: {list(rows[0].keys())}")
    print()
    for r in rows:
        print(f"  Row: {r}")
else:
    print("  (no rows)")

print()
print("=" * 70)
print("COURSES TABLE — QUICK DEPTH CHECK")
print("=" * 70)
courses_res = admin.table("courses").select("*").execute()
courses = courses_res.data or []
print(f"Total rows in 'courses': {len(courses)}")
if courses:
    print(f"Columns: {list(courses[0].keys())}")
    # Show prerequisite edges
    edges = []
    for c in courses:
        prereqs_json = c.get("prerequisites") or {}
        for p in prereqs_json.get("courses", []):
            p_code = p if isinstance(p, str) else p.get("course_code", "")
            if p_code:
                edges.append((p_code.upper(), c["code"].upper()))
    print(f"Prerequisite edges found (embedded JSON): {len(edges)}")
    for e in edges[:15]:
        print(f"  {e[0]} -> {e[1]}")

print()
print("=" * 70)
print("COURSE_PREREQUISITE TABLE — ROWS")
print("=" * 70)
cp_res = admin.table("course_prerequisite").select("*").execute()
cp_rows = cp_res.data or []
print(f"Total rows in 'course_prerequisite': {len(cp_rows)}")
if cp_rows:
    print(f"Columns: {list(cp_rows[0].keys())}")
