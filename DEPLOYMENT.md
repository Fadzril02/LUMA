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

### 1. Schema baseline — dump production, restore to staging

> **Why not replay migrations 01–29?**
> Early migrations (01–16) were written against a drifted database and are not guaranteed
> to replay cleanly on a blank schema. Use the production dump as the authoritative
> baseline. Migrations **30 and later** are applied to both environments going forward.

**Linux / macOS / WSL:**

```bash
# Dump schema only (no data) from production
supabase db dump --db-url "$PROD_DB_URL" --schema public -f schema.sql

# Apply to a freshly created staging Supabase project
psql "$STAGING_DB_URL" -f schema.sql
```

**Windows (no CLI / WSL):**

1. Run the `supabase db dump` command above in WSL or on a Linux machine, then copy `schema.sql` locally.
2. Open the staging project in the **Supabase dashboard → SQL Editor**.
3. Paste the contents of `schema.sql` and click **Run**.

After the schema is applied, future migrations are run individually:

```bash
psql "$STAGING_DB_URL" -f supabase/migrations/30_next_feature.sql
```

### 2. Auth settings (Supabase dashboard)

| Setting             | Value                                               |
|---------------------|-----------------------------------------------------|
| Confirm email       | **ON**                                              |
| SMTP                | Configure with your Resend/SendGrid credentials     |
| Site URL            | Staging frontend URL (Vercel preview or fixed URL)  |
| Redirect URLs       | Add the staging frontend URL + `/complete-registration` |

### 3. Seed advisor invite code

The UTM tenant and its grading scale are created by the schema copy
(originally from migrations 18 and 26). Only an invite code needs to be seeded manually.

Run in the Supabase SQL editor or via `psql`:

```sql
-- UTM tenant + grading scale are created by the schema copy (migrations 18 and 26)
INSERT INTO advisor_invites (code, tenant_id, expires_at)
VALUES (upper(substr(md5(random()::text), 1, 8)), 'UTM', now() + interval '30 days')
RETURNING code;
```

Copy the returned `code` — give it to the staging advisor to complete registration.

### 4. Configure backend environment variables

In the Render dashboard for `syngrad-api-staging`, set all variables from the
**Backend** table above, pointing to the staging Supabase project.

For CORS, either:
- Add the exact Vercel preview URL to `BACKEND_CORS_ORIGINS`, **or**
- Set `BACKEND_CORS_ORIGIN_REGEX=^https://syngrad-git-dev-[a-z0-9-]+\.vercel\.app$`

### 5. Configure frontend environment variables

In the Vercel project for the `dev` branch, set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` pointing at staging services.
