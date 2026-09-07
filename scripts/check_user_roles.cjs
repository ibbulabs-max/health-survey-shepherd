require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/user_roles?limit=1';
  const response = await fetch(url, {
    headers: {
      'apikey': process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
  const data = await response.json();
  console.log("data:", data);
}
run();
