-- ==============================================================================
-- [PROJECT_NAME] Seed Catalog & Prerequisites Graph
-- Company: [COMPANY_NAME]
-- Description: Initial university data, standard Malaysian Computer Science /
--              Software Engineering curriculum and prerequisite DAG
-- Version: 03_seed_catalog.sql
-- ==============================================================================

-- ==============================================================================
-- 1. Seed University (Universiti Teknologi Malaysia - UTM)
-- ==============================================================================
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

-- ==============================================================================
-- 2. Seed Standard Course Catalog & Prerequisite Graph (Software Engineering / CS)
-- ==============================================================================

-- Year 1 Semester 1
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ1013', 'Programming Technique I', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECP1513', 'Discrete Structure', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECR1013', 'Digital Logic', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECV1113', 'Computational Mathematics', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHMS1182', 'Appreciation of Ethics and Civilisations', 2, 'University Requirement', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHMT1012', 'Graduate Success Attributes', 2, 'University Requirement', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 1 Semester 2
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ1023', 'Programming Technique II', 3, 'Core', '{"type": "AND", "courses": ["SECJ1013"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECD2523', 'Database', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECR2043', 'Operating Systems', 3, 'Core', '{"type": "AND", "courses": ["SECR1013"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECV2113', 'Human Computer Interaction', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHLB1112', 'English Communication Skills', 2, 'University Requirement', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 2 Semester 1
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ2013', 'Data Structures and Algorithms', 3, 'Core', '{"type": "AND", "courses": ["SECJ1023"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ2203', 'Software Engineering', 3, 'Core', '{"type": "AND", "courses": ["SECJ1023"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECR2033', 'Computer Networks', 3, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECV2223', 'Web Programming', 3, 'Core', '{"type": "AND", "courses": ["SECJ1013", "SECD2523"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHMS1192', 'Philosophy and Current Issues', 2, 'University Requirement', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 2 Semester 2
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ2154', 'Object Oriented Programming', 4, 'Core', '{"type": "AND", "courses": ["SECJ1023"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ2253', 'Requirements Engineering & Software Modeling', 3, 'Core', '{"type": "AND", "courses": ["SECJ2203"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECD3533', 'Data Mining and Business Intelligence', 3, 'Elective', '{"type": "AND", "courses": ["SECD2523"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'UHLB2122', 'Advanced Academic English Skills', 2, 'University Requirement', '{"type": "AND", "courses": ["UHLB1112"], "min_grade": "C", "min_credits": 0}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 3 Semester 1 & 2
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ3104', 'Applications Development', 4, 'Core', '{"type": "AND", "courses": ["SECJ2154", "SECD2523"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ3263', 'Software Quality Assurance & Testing', 3, 'Core', '{"type": "AND", "courses": ["SECJ2203"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ3303', 'Software Project Management', 3, 'Core', '{"type": "AND", "courses": ["SECJ2203"], "min_grade": "C", "min_credits": 0}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ3032', 'Final Year Project 1', 2, 'Core', '{"type": "AND", "courses": ["SECJ2203", "SECJ2013"], "min_grade": "C", "min_credits": 80}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;

-- Year 4 Semester 1 & 2
INSERT INTO courses (university_id, code, name, credits, category, prerequisites)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECJ4044', 'Final Year Project 2', 4, 'Core', '{"type": "AND", "courses": ["SECJ3032"], "min_grade": "C", "min_credits": 90}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ4118', 'Industrial Training (Practical)', 8, 'Core', '{"type": "AND", "courses": [], "min_grade": "C", "min_credits": 90}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'SECJ4124', 'Industrial Training Report', 4, 'Core', '{"type": "AND", "courses": ["SECJ4118"], "min_grade": "C", "min_credits": 90}'::jsonb)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites;
