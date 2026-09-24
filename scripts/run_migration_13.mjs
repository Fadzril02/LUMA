// Run migration 13 against Supabase using direct Postgres connection
// Usage: node scripts/run_migration_13.mjs

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gexcsnwztzajoupgjhpc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdleGNzbnd6dHpham91cGdqaHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxODU2OCwiZXhwIjoyMDk1NTk0NTY4fQ.atwqiyZ2lCJ2PTOeS3kANfplfw8lBJIU_JotBo5_LGM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sql = readFileSync('supabase/migrations/13_advisee_roster_summary.sql', 'utf8');

async function run() {
  // Execute via rpc if available, otherwise try direct
  console.log('Attempting to execute migration 13...');
  console.log('SQL length:', sql.length, 'chars');
  
  // Try using the Supabase SQL execution via rpc
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.log('rpc exec_sql not available:', error.message);
    console.log('');
    console.log('=== MANUAL STEP REQUIRED ===');
    console.log('The migration SQL must be run manually in the Supabase SQL Editor.');
    console.log('Go to: https://supabase.com/dashboard/project/gexcsnwztzajoupgjhpc/sql/new');
    console.log('Paste the contents of: supabase/migrations/13_advisee_roster_summary.sql');
    console.log('Then run: NOTIFY pgrst, \'reload schema\';');
    console.log('');
  } else {
    console.log('Migration executed successfully:', data);
  }

  // Test if the view exists by querying it
  console.log('Testing if advisee_roster_summary view is accessible...');
  const { data: testData, error: testError } = await supabase
    .from('advisee_roster_summary')
    .select('matric_no')
    .limit(1);

  if (testError) {
    console.log('View NOT accessible:', testError.message);
    console.log('Code:', testError.code);
  } else {
    console.log('View IS accessible! Rows returned:', testData?.length ?? 0);
    console.log('Data:', JSON.stringify(testData));
  }
}

run().catch(console.error);
