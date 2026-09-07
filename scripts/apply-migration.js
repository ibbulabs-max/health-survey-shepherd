const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const sql = fs.readFileSync('supabase/migrations/20260907000011_reconciliation.sql', 'utf8');
  
  // Note: the pg_query RPC must exist for this to work natively via REST.
  // Alternatively, the user can run `npx supabase db push` instead of this script.
  console.log("Attempting to execute migration via RPC (requires a custom execution function)...");
  
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  
  if (error) {
    if (error.code === 'PGRST202') {
      console.error("\n[ERROR] execute_sql RPC not found. You cannot run raw SQL via the REST API securely without it.");
      console.error("Please run the following command instead to apply the migration:");
      console.error("  npx supabase db push");
      console.error("Or copy the contents of supabase/migrations/20260907000011_reconciliation.sql into your Supabase Dashboard SQL Editor.");
    } else {
      console.error("Error executing migration:", error);
    }
    process.exit(1);
  }
  
  console.log("Migration executed successfully!");
}

main();
