require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const { data, error } = await supabase.from('user_roles').select('*').limit(5);
  console.log("Roles data:", data);
  if (error) console.log("Error:", error);
}

run();
