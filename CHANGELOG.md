# Changelog

Newest first. Tag format `v0.x-name`. Note: git tags for these milestones are not created yet; create them on the matching commits.

## Unreleased
- Migration 33: `elective_assignments` table for manual elective overrides (kind='assign' or 'exclude'). Unique `(tenant_id, matric_no, course_code)`, partial unique index on slot for assign. RLS select-only for student own / advisor advisee; writes via backend service role only.
- Manual elective override (SynGrad roadmap 4B): `PUT` and `DELETE` `/audit/progress/{matric_no}/overrides` endpoints (advisor only, advisee check, JWT-derived tenant/advisor ID). Engine slot pinning, course exclusions, stale override fallback with warnings, and bipartite override precedence. Advisor interactive override & exclusion controls in `StudentView.tsx`; read-only badges in student `DegreeAuditView.tsx`.
- Migration 30: `academic-slips` bucket private; uploads only to own `slips/<matric>_...` path; reads only for files listed in `uploaded_documents` the user can see; `degree_audits` read policies.
- Removed `/audit/process-storage` (bypassed student verification) and dead `src/pages/advisor/` + `StudentRadarChart`.
- `/health` stripped to `{status, environment}`.
- Fix: extract crashed saving results (`doc` shadowed by PyMuPDF document).
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
