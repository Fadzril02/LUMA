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
| `SUPABASE_JWT_SECRET`        | Declared in `config.py` (accepted from env) but **not used for user-token verification** — the backend verifies tokens via JWKS/ES256 (`auth.py`). Set it anyway to avoid config noise if your `.env` includes it. |
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

Done once on 2026-10-02. Current staging: Supabase `wgdrmocjwpfcfkqgziri` (Singapore), Render `syngrad-stag` (https://syngrad-stag.onrender.com, branch `dev`), Vercel project `luma` Preview for branch `dev` (https://luma-git-dev-fadzril-my.vercel.app).

### 1. Copy schema + reference data (Windows, PostgreSQL 17 client tools)
Use each project's **Connect → Direct → Session pooler** URI (port 5432). Command Prompt:
```
pg_dump "PROD_URI" --schema=public --schema-only --no-owner -f schema.sql
pg_dump "PROD_URI" --data-only --no-owner --table=public.tenants --table=public.grade_scales --table=public.grade_scale_presets -f seed.sql
psql "STAGING_URI" -f schema.sql
psql "STAGING_URI" -f seed.sql
```
A schema-only dump copies NO rows — tenants and grade scales must come from `seed.sql`. Never copy student data (PDPA). Keep the URIs (they contain DB passwords) out of chats and the repo; reset the DB password if exposed.

### 2. Storage (NOT included in a public-schema dump)
```sql
insert into storage.buckets (id, name, public) values ('academic-slips','academic-slips',false) on conflict do nothing;
```
Then create the two storage policies from migration 30 and VERIFY:
`select policyname, cmd from pg_policies where schemaname='storage';` must return 2 rows (they silently did not stick the first time).

### 3. Supabase Auth (staging)
Confirm email ON; custom SMTP (smtp.resend.com:465, user `resend`, own staging Resend key, sender name "SynGrad Staging"); **URL Configuration → Site URL = staging frontend URL, Redirect URLs = `<staging URL>/**`** (otherwise email links go to localhost:3000).

### 4. Invite code
```sql
insert into advisor_invites (code, tenant_id, expires_at)
values (upper(substr(md5(random()::text),1,8)), 'UTM', now() + interval '30 days') returning code;
```

### 5. Render staging service
New Web Service (same project, environment "Staging"), branch `dev`, Python 3, Singapore, Free. Root dir / build / start = production (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`). Env: staging `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY`, `ENVIRONMENT=staging`, `PYTHON_VERSION=3.12.0`, `FRONTEND_URL` + `BACKEND_CORS_ORIGINS` = staging URL (no trailing slash), `BACKEND_CORS_ORIGIN_REGEX=^https://[a-z0-9-]+-git-dev-[a-z0-9-]+\.vercel\.app$`. **Do not set `CORS_ORIGINS`** — it overrides BACKEND_CORS_ORIGINS. `OPTIONS ... 400` in logs = CORS misconfigured.

### 6. Vercel (same project)
Environment Variables, type **Config**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon/publishable — never service_role), `VITE_API_BASE_URL` — once scoped **Production**, once scoped **Preview → branch `dev`**. Deployment Protection off so testers can open the preview. If `dev` == `main` commit, Vercel won't build: push an empty commit to `dev`.
