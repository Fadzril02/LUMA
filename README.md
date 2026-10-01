# SynGrad

Academic advising SaaS for Malaysian universities (syngrad.my). Students upload result slips; SynGrad builds a cumulative degree audit (credits, CGPA, prerequisites, electives) for the student and their advisor.

**Status (2026-10-01):** UAT with first pilot advisor (UTM). Not yet public.
**Owner:** Novus Mandiri (solo founder). Contact: novusmandiri@gmail.com

## Read these first

| Doc | Use it for |
|---|---|
| [Essentials.md](Essentials.md) | Non-negotiable engineering rules. Read before writing any code or prompt. |
| [Architecture.md](Architecture.md) | Schema, RLS, API, migrations. Section 0 is the current truth. |
| [PRD.md](PRD.md) | Product, users, pricing, roadmap (section 6). |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Staging/production setup, env vars, release flow. |
| [CHANGELOG.md](CHANGELOG.md) | What shipped, per milestone tag. |
| [backend/README.md](backend/README.md) | Running and testing the API locally. |

## Stack

- Frontend: React + Vite + TypeScript + Tailwind → Vercel
- Backend: FastAPI (Python) → Render (`luma-xswf.onrender.com`)
- Data: Supabase (Postgres + RLS, Auth, Storage bucket `academic-slips`)
- Email: Resend (`no-reply@syngrad.my`) for auth SMTP and advising notifications
- LLM: Groq, fallback only for slip lines the regex parser can't read
- Free tiers only until launch. No new paid services, no cron, no polling.

## Branches

- `main` → production. `dev` → staging (see DEPLOYMENT.md).
- Tag each finished milestone (`v0.x-...`).

## Quickstart

```bash
npm install && npm run dev                 # frontend (needs .env with VITE_ vars)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload              # backend
pytest                                     # backend tests (93 passing)
```

Schema changes go **only** through `supabase/migrations/NN_name.sql`, applied in order, never edited after they're applied.
