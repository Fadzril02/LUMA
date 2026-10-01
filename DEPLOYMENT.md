# SynGrad Deployment Guide

## Environments

| Attribute              | Staging                                          | Production                          |
|------------------------|--------------------------------------------------|-------------------------------------|
| **Git branch**         | `dev`                                            | `main`                              |
| **Supabase project**   | `syngrad-staging`                                | `syngrad` (current)                 |
| **Backend (Render)**   | `syngrad-api-staging`                            | `syngrad-api` / `luma-xswf.onrender.com` |
| **Frontend (Vercel)**  | Vercel Preview (auto-deployed on `dev` push)     | `syngrad.my` / `syngrad.vercel.app` |
| **Data policy**        | Test data only — never real student records (PDPA) | Production student data           |

---

## Environment Variables

All secrets are managed in each platform's dashboard. **Never commit secret values to the repository.**

### Backend (Render / Docker)

| Variable                     | Purpose                                                   |
|------------------------------|-----------------------------------------------------------|
| `SUPABASE_URL`               | Supabase project REST URL                                 |
| `SUPABASE_SERVICE_ROLE_KEY`  | Service-role key — backend only, never exposed to browser |
| `SUPABASE_JWT_SECRET`        | Used to verify Supabase-issued JWTs on every request      |
| `RESEND_API_KEY`             | Transactional email (advisor invites, notifications)      |
| `RESEND_FROM`                | Sender address, e.g. `noreply@syngrad.my`                 |
| `BACKEND_CORS_ORIGINS`       | Comma-separated exact allowed origins (no globs)          |
| `BACKEND_CORS_ORIGIN_REGEX`  | Python regex for dynamic preview URLs (optional). Example for staging: `^https://syngrad-git-dev-[a-z0-9-]+\.vercel\.app$` |

### Frontend (Vercel)

| Variable                | Purpose                                              |
|-------------------------|------------------------------------------------------|
| `VITE_SUPABASE_URL`     | Supabase project URL (same value as `SUPABASE_URL`)  |
| `VITE_SUPABASE_ANON_KEY`| Supabase anon key — public, subject to RLS           |
| `VITE_API_BASE_URL`     | FastAPI backend URL, e.g. `https://syngrad-api-staging.onrender.com` |

> **CORS note:** Starlette's `allow_origins` does **exact string matching** — glob patterns like
> `https://*.vercel.app` are silently ineffective. For staging preview URLs use
> `BACKEND_CORS_ORIGIN_REGEX` **or** add the exact Vercel preview URL to `BACKEND_CORS_ORIGINS`.

---

## Feature Workflow

```
dev branch                                  main branch
──────────────────────────────────────────────────────────────────
build feature on dev
git push origin dev
  └─▶ Vercel preview auto-deploys
  └─▶ Run migration on staging Supabase:
        psql $STAGING_DB_URL < supabase/migrations/NN_name.sql
test on staging (advisor + student smoke test)
  └─▶ PASS → merge dev → main
              git push origin main
                └─▶ Vercel production auto-deploys
                └─▶ Run the SAME migration on production Supabase:
                      psql $PROD_DB_URL < supabase/migrations/NN_name.sql
                └─▶ tag: git tag vYYYY-MM-DD && git push --tags
```

---

## Rules

1. **`supabase/migrations/` is the only way the schema changes.** Never alter tables
   directly in the Supabase dashboard on production.
2. **Staging = test data only.** Do not copy real student records to staging (PDPA compliance).
3. **Never push experiments directly to `main`.** All work goes through `dev` first.
4. Migrations are numbered sequentially (`01_`, `02_`, …). Apply them **in order** —
   never skip, never re-run a previously applied migration.
5. If a migration must be rolled back, use the `-- ROLLBACK` block included at the
   bottom of each migration file inside a `BEGIN; … COMMIT;` transaction.

---

## Setting Up a Staging Environment from Scratch

### 1. Supabase project

Create a new Supabase project (`syngrad-staging`). Then apply all migrations in order:

```bash
# From the repo root — replace $STAGING_DB_URL with the Supabase connection string
for f in supabase/migrations/*.sql; do
  echo "Applying $f…"
  psql "$STAGING_DB_URL" < "$f"
done
```

### 2. Auth settings (Supabase dashboard)

| Setting             | Value                                               |
|---------------------|-----------------------------------------------------|
| Confirm email       | **ON**                                              |
| SMTP                | Configure with your Resend/SendGrid credentials     |
| Site URL            | Staging frontend URL (Vercel preview or fixed URL)  |
| Redirect URLs       | Add the staging frontend URL + `/complete-registration` |

### 3. Seed tenant + advisor invite code

Run the following SQL in the Supabase SQL editor or via `psql`:

```sql
-- Seed tenant (UTM) — matches the UUID used in tests and migrations
INSERT INTO tenants (id, name, repeat_policy)
VALUES ('00000000-0000-0000-0000-000000000001', 'UTM', 'latest')
ON CONFLICT (id) DO NOTHING;

-- Seed the UTM university row referenced by the course catalog
INSERT INTO universities (id, name, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'Universiti Teknologi Malaysia', 'UTM')
ON CONFLICT (id) DO NOTHING;

-- Create an advisor invite code for staging testing
-- Replace <YOUR_STAFF_ID> and <YOUR_EMAIL> with real staging values
INSERT INTO advisor_invite_codes (code, staff_id, institutional_email, tenant_id, used, expires_at)
VALUES (
  'STAGING-INVITE-2026',
  'TEST999',
  'advisor@staging.utm.my',
  '00000000-0000-0000-0000-000000000001',
  false,
  now() + interval '90 days'
)
ON CONFLICT DO NOTHING;
```

### 4. Configure backend environment variables

In the Render dashboard for `syngrad-api-staging`, set all variables from the
**Backend** table above, pointing to the staging Supabase project.

For CORS, either:
- Add the exact Vercel preview URL to `BACKEND_CORS_ORIGINS`, **or**
- Set `BACKEND_CORS_ORIGIN_REGEX=^https://syngrad-git-dev-[a-z0-9-]+\.vercel\.app$`

### 5. Configure frontend environment variables

In the Vercel project for the `dev` branch, set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` pointing at staging services.
