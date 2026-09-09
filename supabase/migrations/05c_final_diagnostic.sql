-- Run this in Supabase SQL Editor and share ALL output

-- QUERY 1: Is RLS actually turned on at the table level?
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    relforcerowsecurity AS rls_force
FROM pg_class
WHERE relname IN ('students', 'academic_records') 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- QUERY 2: If rls_enabled is false for students, fix it now:
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

-- QUERY 3: Confirm it's now on
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    relforcerowsecurity AS rls_force
FROM pg_class
WHERE relname IN ('students', 'academic_records') 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
