-- ==============================================================================
-- [PROJECT_NAME] Row-Level Security (RLS) Policies
-- Company: [COMPANY_NAME]
-- Description: Multi-tenant data isolation and Storage bucket RLS policies
-- Version: 02_rls_policies.sql
-- ==============================================================================

-- ==============================================================================
-- 1. Enable RLS on All Tables
-- ==============================================================================
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE degree_audits ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. Universities Policies
-- ==============================================================================
-- Any authenticated user can view the university they belong to
CREATE POLICY "Advisors can view their associated university"
ON universities FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT university_id FROM advisors WHERE id = auth.uid()
    )
);

-- ==============================================================================
-- 3. Advisors Policies
-- ==============================================================================
-- Advisors can view and update only their own profile
CREATE POLICY "Advisors can view their own profile"
ON advisors FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Advisors can update their own profile"
ON advisors FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow initial profile insertion on registration
CREATE POLICY "Advisors can insert their initial profile"
ON advisors FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ==============================================================================
-- 4. Students Policies (Tenant & Advisor Isolated)
-- ==============================================================================
CREATE POLICY "Advisors can view their assigned students"
ON students FOR SELECT
TO authenticated
USING (advisor_id = auth.uid());

CREATE POLICY "Advisors can insert students"
ON students FOR INSERT
TO authenticated
WITH CHECK (advisor_id = auth.uid());

CREATE POLICY "Advisors can update their assigned students"
ON students FOR UPDATE
TO authenticated
USING (advisor_id = auth.uid())
WITH CHECK (advisor_id = auth.uid());

CREATE POLICY "Advisors can delete their assigned students"
ON students FOR DELETE
TO authenticated
USING (advisor_id = auth.uid());

-- ==============================================================================
-- 5. Courses Policies
-- ==============================================================================
-- Advisors can view all courses in their university catalog
CREATE POLICY "Advisors can view courses for their university"
ON courses FOR SELECT
TO authenticated
USING (
    university_id IN (
        SELECT university_id FROM advisors WHERE id = auth.uid()
    )
);

-- Advisors can create/update courses for their university
CREATE POLICY "Advisors can manage courses for their university"
ON courses FOR ALL
TO authenticated
USING (
    university_id IN (
        SELECT university_id FROM advisors WHERE id = auth.uid()
    )
)
WITH CHECK (
    university_id IN (
        SELECT university_id FROM advisors WHERE id = auth.uid()
    )
);

-- ==============================================================================
-- 6. Academic Records Policies
-- ==============================================================================
CREATE POLICY "Advisors can view academic records for their students"
ON academic_records FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM students WHERE advisor_id = auth.uid()
    )
);

CREATE POLICY "Advisors can insert academic records for their students"
ON academic_records FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM students WHERE advisor_id = auth.uid()
    )
);

CREATE POLICY "Advisors can update academic records for their students"
ON academic_records FOR UPDATE
TO authenticated
USING (
    student_id IN (
        SELECT id FROM students WHERE advisor_id = auth.uid()
    )
)
WITH CHECK (
    student_id IN (
        SELECT id FROM students WHERE advisor_id = auth.uid()
    )
);

CREATE POLICY "Advisors can delete academic records for their students"
ON academic_records FOR DELETE
TO authenticated
USING (
    student_id IN (
        SELECT id FROM students WHERE advisor_id = auth.uid()
    )
);

-- ==============================================================================
-- 7. Degree Audits Policies
-- ==============================================================================
CREATE POLICY "Advisors can view degree audits for their students"
ON degree_audits FOR SELECT
TO authenticated
USING (advisor_id = auth.uid());

CREATE POLICY "Advisors can insert degree audits"
ON degree_audits FOR INSERT
TO authenticated
WITH CHECK (advisor_id = auth.uid());

CREATE POLICY "Advisors can update degree audits"
ON degree_audits FOR UPDATE
TO authenticated
USING (advisor_id = auth.uid())
WITH CHECK (advisor_id = auth.uid());

-- ==============================================================================
-- 8. Storage Bucket RLS Policies (`storage.objects`)
-- Bucket: `transcripts`
-- Path convention: transcripts/{advisor_id}/{filename}
-- ==============================================================================

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow advisors to upload transcripts to their own folder
CREATE POLICY "Advisors can upload transcripts to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'transcripts' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow advisors to read their own uploaded transcripts
CREATE POLICY "Advisors can read their own uploaded transcripts"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'transcripts' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow advisors to delete their own uploaded transcripts
CREATE POLICY "Advisors can delete their own uploaded transcripts"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'transcripts' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
