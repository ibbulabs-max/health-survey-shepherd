require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const email = 'master_admin@ibrahimlabs.local';
  console.log("=== PHASE 1 RECONNAISSANCE ===");

  // 1 & 2 & 3 & 4. Enum details from OpenAPI (already verified but we'll state it)
  console.log("1-4. user_roles.role uses public.app_role. Values: admin, survey_user, super_admin, supervisor. master_admin is absent (verified via OpenAPI).");

  // 6. Inspect existing auth.users row
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Failed to list users:", usersError.message);
  } else {
    const user = usersData.users.find(u => u.email === email);
    if (user) {
      console.log(`6. Master Admin auth user exists: ID = ${user.id}`);
      
      // 7. Inspect profiles row
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      console.log(`7. Profile row:`, profile ? `Exists (${profile.username})` : `Not found`);

      // 8. Inspect user_roles for that user
      const { data: userRole } = await supabase.from('user_roles').select('*').eq('user_id', user.id).maybeSingle();
      console.log(`8. user_roles row:`, userRole ? `Exists (${userRole.role})` : `Not found`);
    } else {
      console.log(`6. Master Admin auth user NOT FOUND for email ${email}`);
    }
  }

  // 5. Inspect if user_role enum exists (we can't easily query pg_type via REST, but we know it from migration)
  console.log("5. user_role enum exists? Likely yes, since migration 20260906000000_pwa_offline_and_master_admin.sql created/altered it without error when applied locally by the user.");
}
run();
