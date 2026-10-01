# Changelog

Newest first. Tag format `v0.x-name`. Note: git tags for these milestones are not created yet; create them on the matching commits.

## Unreleased
- Migration 30: `academic-slips` bucket private; uploads only to own `slips/<matric>_...` path; reads only for files listed in `uploaded_documents` the user can see; `degree_audits` read policies.
- `/audit/process-storage` ownership check (advisor-only, document row required).
- CORS: wildcard origins replaced with `BACKEND_CORS_ORIGIN_REGEX`.
- DEPLOYMENT.md (staging/production plan).

## v0.5-upload-security
- Extraction results stored server-side (`original_courses`); student confirms via `/audit/submit-verification`; server computes `is_altered`.
- Ownership checks on extract, finalize, reject. Migration 29 locks `uploaded_documents`.

## v0.4-frontend-grading
- Frontend uses tenant grade scale; advisor exemptions screen; roster view computes CGPA from grade scale (migration 28).

## v0.3-grading-scale
- `grade_scales` per tenant + presets (migration 26). Multi-attempt records with repeat policy (migration 27).

## v0.2-advising-notes
- Advising logs v2, student read view, email notification via Resend, 1/student/hour (migrations 24–25).

## v0.1-uat-working
- Tenants, advisor invites, RLS lockdown, elective slots, cohort lockdown (migrations 17–23). Sign-up → upload → approve flow working.
