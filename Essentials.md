# LUMA • Engineering Standards & Core Principles (Essentials)
## The Non-Negotiable Rules of the LUMA Codebase

---

### Document Information
* **Document:** LUMA Engineering Charter & Coding Standards
* **Author:** Principal Staff Engineer & Technical Architecture Team
* **Scope:** All Frontend (React/TypeScript), Backend (Python/FastAPI), and Database (PostgreSQL/Supabase) Contributions
* **Status:** Mandatory Repository Policy
* **Version:** 1.0.0

---

## 1. The Four Pillar Principles

Every pull request, architectural decision, and line of code committed to this repository must strictly adhere to the following four immutable engineering pillars:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        THE FOUR PILLARS OF LUMA                           │
├─────────────────────────────────────┬─────────────────────────────────────┤
│ 1. ACADEMIC MINIMALISM (UI/UX)      │ 2. DATA INTEGRITY OVER UX           │
│ Clean institutional utility. Deep   │ Hard database constraints govern.   │
│ navy & white palette. Zero fluff.   │ Never silently fail or default.     │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ 3. ZERO-TRUST CLIENT                │ 4. VARIABLE-DRIVEN RENDERING        │
│ The frontend is compromised. Audit  │ No hardcoded fallbacks. Everything  │
│ provenance & cross-check JWTs.      │ inherits dynamically from blueprints│
└─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Pillar 1: UI/UX Standard — "Academic Minimalist"

LUMA is an institutional academic advising platform, not an entertainment app, marketing website, or generic venture-funded SaaS product. Its visual design must command institutional authority, clarity, and utilitarian density.

### 2.1 The Palette
* **Primary Deep Navy:** `bg-blue-950` (`#0F172A` / `#172554`), `text-blue-900` (`#1E3A8A`), `border-blue-900`.
* **Institutional Crimson Accent:** `#990033` (UTM Maroon), used sparingly for primary institutional branding and critical alert banners.
* **Functional State Colors:**
  * **Critical Error / Forgery:** `bg-rose-50`, `border-rose-200`, `text-rose-700` (Never neon red).
  * **Verified / Active:** `bg-emerald-50`, `border-emerald-200`, `text-emerald-700`.
  * **Pending Audit / Warning:** `bg-amber-50`, `border-amber-200`, `text-amber-800`.
* **Neutral Canvas:** Clean white cards (`bg-white`), neutral page canvas (`bg-[#F9FAFB]`), subtle hair-thin borders (`border-gray-200`).

### 2.2 Prohibited Aesthetics (Strictly Enforced)
* ❌ **No Playful Gradients or Mesh Blobs:** Avoid rainbow background gradients, animated pastel blobs, and purple/pink neon glow effects.
* ❌ **No Generic SaaS "Bubble" Aesthetics:** Avoid giant pill-shaped buttons with massive box shadows, floating decorative elements, and excessive border radiuses (`rounded-3xl` or `rounded-full` on cards).
* ❌ **No Uninformative Placeholders:** Never use placeholder images or unstyled mock text. If tabular data is loading, display a clean institutional skeleton loader or spinner.

### 2.3 Required Design Patterns
* ✅ **High Information Density:** Dense tables with clear column headers, monospace font for codes (`font-mono`), and compact badges.
* ✅ **Explicit System Feedback:** Use Sonner toasts (`toast.success()`, `toast.error()`) alongside persistent in-form alert banners for all state transitions.
* ✅ **State-Responsive Button Hierarchy:** Main submit buttons must visibly indicate disabled states (`disabled:opacity-50 disabled:cursor-not-allowed`) and display an inline `Loader2` spinner during active network transactions.

---

## 3. Pillar 2: Data Integrity Over UX (Fail Fast & Hard Constraints)

In academic record management, **a clean error message is infinitely better than corrupted data**. The frontend must never silently swallow an error, create mock fallback records, or bypass database validation.

### 3.1 Hard Database Constraints Govern
* Frontend form validation is an ergonomic convenience; the PostgreSQL database schema is the sole authoritative source of truth.
* Primary Key rules and Check Constraints (such as `CHECK (matric_no ~* '^[A-Z]\d{2}[A-Z]{2}\d{4}$')`) must never be loosened to accommodate unvalidated client requests.

### 3.2 Strict Prohibition of Silent Fallbacks
* **No Default UUIDs:** If a request payload is missing an entity ID (e.g., `template_id`, `cohort_id`, or `advisor_staff_id`), the server must reject the call with HTTP `422 Unprocessable Entity`. Generating a random UUID (`uuid4()`) as a fallback is strictly prohibited.
* **No Fake Academic Records:** If a course code cannot be extracted from a transcript, it must be flagged for human review (`processing_status = 'Pending_Advisor_Approval'`), never synthesized or guessed.
* **Ruthless Cache Invalidation:** When user sessions expire or errors occur during sign-out, the client must unconditionally wipe local tokens. The `finally` block in [`AuthContext.tsx`](file:///d:/smart-aa-system/src/context/AuthContext.tsx) enforces this pattern:

```typescript
// Enforce ruthless local cache wipe regardless of server API errors
try {
  setIsLoading(true);
  await supabase.auth.signOut();
} catch (error) {
  console.warn("[AuthContext] Server signOut failed, forcing local wipe:", error);
} finally {
  setUser(null);
  setProfile(null);
  // Ruthlessly wipe all Supabase tokens from browser cache
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('sb-')) {
      localStorage.removeItem(key);
    }
  });
  setIsLoading(false);
  window.location.href = '/';
}
```

---

## 4. Pillar 3: Zero-Trust Client Architecture

The frontend client operates in an untrusted user environment. All student submissions, grade claims, and identity assertions must be treated as potentially malicious or altered.

### 4.1 Provenance Tracking & The Tamper Trap
* When students review OCR-extracted records in the verification modal, direct edits to course codes or grades must **never overwrite the extracted ground truth in place**.
* The handler [`handleStagedDataChange`](file:///d:/smart-aa-system/src/app/pages/student/StudentPortal.tsx#L286-L301) must immediately preserve original AI values and flag the record:

```typescript
// MANDATORY PROVENANCE LOCK
if (!newData.courses[index].ai_grade && field === "grade") {
  newData.courses[index].ai_grade = newData.courses[index].grade;
}
if (!newData.courses[index].ai_course_code && field === "course_code") {
  newData.courses[index].ai_course_code = newData.courses[index].course_code;
}

newData.courses[index].is_altered = true;
newData.courses[index][field] = value.toUpperCase();
```

* In the Advisor's [`CorrectionsQueue.tsx`](file:///d:/smart-aa-system/src/app/pages/advisor/CorrectionsQueue.tsx), any record with `is_altered: true` or `fraud_flag: true` triggers high-contrast system alerts and renders the original document PDF side-by-side with student claims.

### 4.2 Backend JWT Cross-Referencing
* The FastAPI backend never trusts identity claims passed in JSON request bodies.
* For every advisor mutation (`/finalize-approval`, `/extract`, `/process-storage`), the dependency [`verify_advisor_jwt`](file:///d:/smart-aa-system/backend/app/core/auth.py) decodes the cryptographically signed JWT via live JWKS, and `_check_advisor_identity` verifies that the JWT email matches the claimed `advisor_id` in the database.
* Mismatched identities immediately result in an immutable HTTP `403 Forbidden` response.

---

## 5. Pillar 4: Variable-Driven Rendering (No Hardcoded Fallbacks)

LUMA is a multi-tenant blueprint engine designed to support multiple faculties, syllabus years, and universities without codebase modifications.

### 5.1 The Rule of Zero Hardcoded Curricula
* **Prohibited Code Patterns:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN:
  const program = student.program || "SECJ";
  const syllabus = student.syllabus || "2024/2025";
  const uni = "Universiti Teknologi Malaysia";
  ```
* **Required Code Patterns:**
  * All degree codes, program titles, syllabus years, and required credit hours must be dynamically derived from the `degree_templates` SQL join:
  ```typescript
  // ✅ MANDATORY DYNAMIC RESOLUTION:
  const tmpl = Array.isArray(cohort.degree_templates) 
    ? cohort.degree_templates[0] 
    : cohort.degree_templates;
  const programCode = tmpl?.program_code;
  const syllabusYear = tmpl?.syllabus_year;
  const programName = tmpl?.program_name;
  
  if (!programCode || !syllabusYear) {
    throw new Error("Corrupted cohort: missing linked degree blueprint.");
  }
  ```

### 5.2 Dynamic Form Configuration
* The student registration form must never offer dropdowns for syllabus versions. By validating the advisor's 6-character `cohort_code`, the system automatically resolves the linked `degree_templates` row and injects the proper blueprint keys into the student's record.

---

## 6. Codebase Anatomy & File Map

Contributors must place files according to the established module boundaries:

```
d:\smart-aa-system\
├── backend/                             # Python Analytical Engine
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth.py                  # ES256 JWKS JWT verification & cross-check
│   │   │   ├── config.py                # Pydantic v2 settings & environment variables
│   │   │   └── supabase_client.py       # Thread-safe Supabase service wrapper
│   │   ├── engine/
│   │   │   ├── extractor.py             # PyMuPDF fast in-memory byte-stream parser
│   │   │   ├── graph_resolver.py        # NetworkX prerequisite DAG verification
│   │   │   ├── llm_fallback.py          # Gemini 1.5 Flash zero-temp micro-LLM
│   │   │   └── parsers/
│   │   │       └── malaysian_regex.py   # Deterministic transcript regex patterns
│   │   ├── schemas/                     # Pydantic request/response schemas
│   │   │   └── audit.py                 # Degree audit DTOs & payloads
│   │   └── v1/
│   │       └── endpoints/
│   │           └── audit.py             # Secure degree audit route handlers
│   └── main.py                          # FastAPI application entrypoint
│
├── src/                                 # Frontend Client SPA
│   ├── app/
│   │   ├── components/ui/               # Headless, high-contrast UI primitives
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx          # Institutional landing & quick auth
│   │   │   ├── advisor/
│   │   │   │   ├── AdvisorDashboard.tsx # Cohort Gatekeeper & Surveillance Panel
│   │   │   │   ├── CorrectionsQueue.tsx # Document audit & side-by-side verification
│   │   │   │   └── StudentsList.tsx     # Full advisee roster diagnostics
│   │   │   └── student/
│   │   │       ├── StudentPortal.tsx    # Upload slips & tamper-trapped staging
│   │   │       ├── DegreeAuditView.tsx  # Interactive curriculum DAG checklist
│   │   │       └── AcademicHistoryView.tsx # Historical transcript timeline
│   │   └── routes.tsx                   # React Router v7 route definitions
│   ├── context/
│   │   └── AuthContext.tsx              # Session lifecycle & zombie-session purge
│   ├── lib/
│   │   ├── api.ts                       # Axios client with automatic Bearer injection
│   │   └── supabase.ts                  # Supabase JS client configuration
│   └── pages/
│       └── auth/
│           └── StudentAuth.tsx          # Real-time matric regex & contest flow
│
└── supabase/
    └── migrations/                      # PostgreSQL DDL & RLS Policies
        ├── 01_schema.sql                # Core institutional tables
        ├── 06_rls_hardening.sql         # Nuclear RLS drop & strict identity isolation
        ├── 08_multi_tenant_blueprint_architecture.sql # Blueprints & Cohorts
        └── 09_loose_admission_safety_net.sql # Registration disputes & RLS
```

---

## 7. Quality Assurance & Pull Request Checklist

Before any code is merged into `main` or deployed to production, the developer must verify the following items:

* [ ] **Zero TypeScript Errors:** `npm run build` must compile cleanly in `< 5 seconds`.
* [ ] **Strict Matric Validation:** Matric Number inputs enforce `/^[A-Z]\d{2}[A-Z]{2}\d{4}$/i` with inline helper text `"Expected format: A24CS0001"` and button disablement.
* [ ] **RLS Tenancy Verification:** All new database tables must run `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
* [ ] **JWKS Auth on Mutating Endpoints:** Every mutating FastAPI endpoint in `backend/app/v1/endpoints/` must depend on `Depends(verify_advisor_jwt)` and execute `_check_advisor_identity()`.
* [ ] **No Hardcoded Constants:** Grep codebase for `'SECJ'`, `'2024/2025'`, or fallback strings. Ensure all parameters are variable-driven from `degree_templates`.
* [ ] **Tamper Provenance Preserved:** Staged course modifications in `StudentPortal.tsx` must preserve `ai_grade` and toggle `is_altered = true`.
* [ ] **Zombie Session Prevention:** Logout routines must execute local token eradication in a `finally` block.
