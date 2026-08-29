import { createClient } from "@supabase/supabase-js";

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://wctgaujblzvckvvauchj.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try selecting from houses
  const { data: houses, error: err } = await supabase.from('houses').select('id').limit(1);
  console.log("Service key access houses:", houses, err);

  // Instead of querying pg_policies which needs sql access, we can test client side insert
  // But wait, to know the policies we need SQL access. 
  // Let's see if we can query pg_policies via REST by default (sometimes it's allowed)
  const { data, error } = await supabase.from('pg_policies').select('*').limit(10);
  console.log("pg_policies query:", data, error);
}
run();
