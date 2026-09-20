-- ==============================================================================
-- Migration: Curriculum Seed Remediation + Founding Advisor Flag
-- Version: 11_remediation_curriculum_seed.sql
-- Description:
--   1. Applies the is_founding_advisor flag to the advisors table (idempotent,
--      mirrors intent of migration 10 which targets the live advisors schema).
--   2. Ensures the 'courses' table exists per 01_schema.sql blueprint.
--   3. Seeds the full UTM Software Engineering (SECJ) curriculum with explicit
--      min_grade = 'C' on all prerequisite edges (JSONB format).
-- 
--   NOTE: The live 'advisors' table (multi-tenant Phase 0 pivot) differs from
--   the 01_schema.sql design. This migration targets the ACTUAL live columns.
-- ==============================================================================

-- ===========================================================================
-- PART 1: Add is_founding_advisor to the LIVE advisors table
--         (The live table uses staff_id PK, not UUID id)
-- ===========================================================================
ALTER TABLE advisors
  ADD COLUMN IF NOT EXISTS is_founding_advisor BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_advisors_founding
  ON advisors(is_founding_advisor)
  WHERE is_founding_advisor = true;

COMMENT ON COLUMN advisors.is_founding_advisor IS
  'Flags founding advisors during Phase 1 UAT Pilot (capped at 5). Grants permanently free, full access across all platform capabilities.';

-- ===========================================================================
-- PART 2: Ensure universities table has UTM seed row (prerequisite for courses)
-- ===========================================================================
INSERT INTO universities (id, name, code, grading_scale, min_cgpa_good_standing)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Universiti Teknologi Malaysia',
    'UTM',
    '{
        "A+": 4.00, "A": 4.00, "A-": 3.67,
        "B+": 3.33, "B": 3.00, "B-": 2.67,
        "C+": 2.33, "C": 2.00, "C-": 1.67,
        "D+": 1.33, "D": 1.00, "E": 0.00,
        "HL": 0.00, "TD": 0.00, "TS": 0.00, "TL": 0.00
    }'::jsonb,
    2.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    grading_scale = EXCLUDED.grading_scale,
    min_cgpa_good_standing = EXCLUDED.min_cgpa_good_standing;

-- ===========================================================================
-- PART 3: Seed Full UTM SECJ Course Catalog with explicit min_grade = 'C'
--         on all prerequisite edges. 
--         Table: courses (UUID-based, per 01_schema.sql)
-- ===========================================================================

-- Year 1 Semester 1 — No prerequisites
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ1013', 'Programming Technique I',             3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECP1513', 'Discrete Structure',                   3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECR1013', 'Digital Logic',                        3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECV1113', 'Computational Mathematics',            3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHMS1182', 'Appreciation of Ethics and Civilisations', 2, 'University Requirement', '{"type": "AND", "courses": [],                        "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHMT1012', 'Graduate Success Attributes',          2, 'University Requirement', '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 1 Semester 2 — Requires Prog Tech I / Digital Logic
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ1023', 'Programming Technique II',            3, 'Core',                 '{"type": "AND", "courses": ["SECJ1013"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECD2523', 'Database',                             3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECR2043', 'Operating Systems',                    3, 'Core',                 '{"type": "AND", "courses": ["SECR1013"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECV2113', 'Human Computer Interaction',           3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHLB1112', 'English Communication Skills',        2, 'University Requirement', '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 2 Semester 1 — Requires Prog Tech II / empty
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ2013', 'Data Structures and Algorithms',      3, 'Core',                 '{"type": "AND", "courses": ["SECJ1023"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ2203', 'Software Engineering',                3, 'Core',                 '{"type": "AND", "courses": ["SECJ1023"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECR2033', 'Computer Networks',                   3, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECV2223', 'Web Programming',                     3, 'Core',                 '{"type": "AND", "courses": ["SECJ1013", "SECD2523"],        "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHMS1192', 'Philosophy and Current Issues',       2, 'University Requirement', '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 2 Semester 2 — Requires Prog Tech II / Software Engineering
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ2154', 'Object Oriented Programming',         4, 'Core',                 '{"type": "AND", "courses": ["SECJ1023"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ2253', 'Requirements Engineering & Software Modeling', 3, 'Core',        '{"type": "AND", "courses": ["SECJ2203"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECD3533', 'Data Mining and Business Intelligence', 3, 'Elective',           '{"type": "AND", "courses": ["SECD2523"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHLB2122', 'Advanced Academic English Skills',    2, 'University Requirement', '{"type": "AND", "courses": ["UHLB1112"],                   "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 3 Semester 1 & 2
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ3104', 'Applications Development',            4, 'Core',                 '{"type": "AND", "courses": ["SECJ2154", "SECD2523"],        "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ3263', 'Software Quality Assurance & Testing', 3, 'Core',               '{"type": "AND", "courses": ["SECJ2203"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ3303', 'Software Project Management',         3, 'Core',                 '{"type": "AND", "courses": ["SECJ2203"],                   "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ3032', 'Final Year Project 1',                2, 'Core',                 '{"type": "AND", "courses": ["SECJ2203", "SECJ2013"],        "min_grade": "C", "min_credits": 80}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 4 Semester 1 & 2
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ4044', 'Final Year Project 2',                4, 'Core',                 '{"type": "AND", "courses": ["SECJ3032"],                   "min_grade": "C", "min_credits": 90}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ4118', 'Industrial Training (Practical)',     8, 'Core',                 '{"type": "AND", "courses": [],                             "min_grade": "C", "min_credits": 90}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ4124', 'Industrial Training Report',          4, 'Core',                 '{"type": "AND", "courses": ["SECJ4118"],                   "min_grade": "C", "min_credits": 90}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- ===========================================================================
-- PART 4: Ensure Software Engineering Project I (SECP2243) is seeded
-- ===========================================================================
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECP2243', 'Software Engineering Project I',      3, 'Core',                 '{"type": "AND", "courses": ["SECJ2203"],                   "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;
