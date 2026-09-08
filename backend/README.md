# Smart Academic Assessment System - Backend Engine

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
Update `.env` with your actual Supabase credentials and optional LLM keys:
* `SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`
* `SUPABASE_ANON_KEY`
* `LLM_API_KEY` (Groq or OpenAI compatible, for ambiguous line parsing)

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

---

## 🔒 Security Best Practices
* **Zero Secret Leakage:** Never commit `.env` or files containing secret keys.
* **Service Role Isolation:** The backend uses Supabase Service Role strictly server-side for authenticated storage downloads and audit persistence.
