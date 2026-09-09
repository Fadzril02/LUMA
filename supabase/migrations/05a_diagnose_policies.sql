-- ==============================================================================
-- DIAGNOSTIC: Show all current policies on students and academic_records
-- Run this FIRST to see what policies exist
-- ==============================================================================
SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles::text, 
    cmd, 
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('students', 'academic_records')
ORDER BY tablename, policyname;
