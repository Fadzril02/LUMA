# SynGrad API (FastAPI)

> Endpoint list, schema and RLS: see `../Architecture.md` §0. Env vars per environment: `../DEPLOYMENT.md`.

High-performance, zero-waste FastAPI backend engine for automated degree audits, transcript parsing, prerequisite DAG graph evaluation, and student academic tracking.

---

## 🏗️ Architecture Overview

```text
backend/
├── app/
│   ├── main.py                  <- FastAPI application entrypoint & CORS config
│   ├── v1/
│   │   ├── router.py            <- API v1 router aggregator
│   │   └── endpoints/
│   │       ├── audit.py         <- In-memory transcript parsing & degree audit endpoint
│   │       ├── courses.py       <- Course catalog & curriculum CSV ingestion
│   │       └── health.py        <- Health check & diagnostic endpoint
│   ├── engine/
│   │   ├── extractor.py         <- PyMuPDF in-memory stream parser (<50ms)
│   │   ├── graph_resolver.py    <- DAG prerequisite & graduation requirement engine
│   │   ├── llm_fallback.py      <- Micro-LLM fallback for ambiguous lines
│   │   └── parsers/
│   │       ├── csv_course_parser.py
│   │       └── malaysian_regex.py
│   ├── core/
│   │   ├── config.py            <- Centralized environment settings (BaseSettings)
│   │   └── supabase_client.py   <- Supabase client factory & service methods
│   └── schemas/
│       ├── audit.py             <- Pydantic audit data models
│       └── course.py            <- Pydantic course data models
├── tests/
│   └── test_zero_waste_engine.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
* Python 3.10+ (Recommended: Python 3.11+)
* Virtual environment (`venv` or `conda`)

### 2. Environment Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy the `.env.example` template:
```bash
cp .env.example .env
```
Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `BACKEND_CORS_ORIGINS`, `ENVIRONMENT`.
Optional: `BACKEND_CORS_ORIGIN_REGEX` (e.g. Vercel previews), `GROQ_API_KEY`/`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` (LLM fallback), `RESEND_API_KEY`, `RESEND_FROM` (advising emails).
`SUPABASE_JWT_SECRET` is not used for user tokens (JWKS ES256).

### 4. Run the Server Locally
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Once running, the interactive Swagger documentation is available at:
* **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🧪 Running Automated Tests

Run the test suite with `pytest`:
```bash
pytest tests/
```

93 tests at 2026-10-01. `tests/conftest.py` stubs document ownership unless a test is marked `real_doc_auth`.

---

## 🔒 Security & Data Retention Policy

### Data Retention & Transcript PDF Purging
To comply with student privacy policies and minimize sensitive data footprint during pilot/UAT testing, raw transcript PDF files are not retained permanently in storage after processing:

1. **Purge Condition:** A document PDF may only be purged **after** its status has been set to `'Approved'` by an academic advisor. Documents in `'Pending_Student_Verification'`, `'Pending_Advisor_Approval'`, or `'Rejected'` cannot be purged to preserve source verification capabilities.
2. **Preservation of Audit Trail:** Purging deletes the actual binary PDF from the Supabase Storage bucket (`academic-slips`) and sets `file_path = '[PURGED]'` in the `uploaded_documents` table. The database row, extracted course grades, and foreign keys (`results.document_id`, `correction_requests.document_id`) remain intact.
3. **Immutable Audit Logging:** Every purge operation is automatically recorded in `system_audit_logs` with action type `'DELETE'`.
4. **Execution Methods (Phase 1 / Pilot):**
   * **Admin API Endpoint:** `POST /api/v1/audit/purge-document` (payload: `{"document_id": "<UUID>"}`)
   * **Admin CLI Utility:**
     ```bash
     python scripts/purge_document.py --doc-id <UUID>
     python scripts/purge_document.py --matric <MATRIC_NO>
     ```
5. **Phase 2 Roadmap:** Automatic purge-on-approval will be activated once UAT confidence in zero-waste extraction is fully established.

