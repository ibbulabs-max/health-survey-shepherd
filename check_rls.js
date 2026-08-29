const { createClient } = require("@supabase/supabase-js");

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://wctgaujblzvckvvauchj.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc("exec_sql", { query: "SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'houses';" });
  
  if (error) {
    console.log("RPC exec_sql failed (might not exist):", error);
    
    // Fallback: try to query via PostgREST if exposed (unlikely for pg_policies)
    // Or we can just use Postgres client if we had connection string, but we only have URL and Key.
  } else {
    console.log("Policies:", data);
  }
}

run();
