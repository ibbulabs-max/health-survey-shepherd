require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/rpc/';
  console.log("We can't list RPCs easily without OpenAPI. Let's try to query an RPC that might exist, like 'exec' or 'execute_sql'");
  const { data, error } = await supabase.rpc('execute_sql', { query: "SELECT 1" });
  console.log("execute_sql:", error ? error.message : data);
}

run();
