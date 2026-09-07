require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const userId = 'b0e3d9b0-5980-4516-8344-94175f247d2e';

  // Verify Auth User
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    console.log("Auth user: FAIL", userError);
  } else {
    console.log("Auth user: PASS");
    // Update password so we can test it later
    await supabase.auth.admin.updateUserById(userId, { password: 'MasterPassword123!' });
  }

  // Verify Profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (profile) {
    console.log("Profile: PASS");
  } else {
    console.log("Profile: FAIL");
  }

  // Provision Role
  const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  if (roles && roles.length > 0) {
    console.log("Role already exists:", roles[0].role);
  } else {
    const { error: insertError } = await supabase.from('user_roles').insert({ user_id: userId, role: 'master_admin' });
    if (insertError) {
      console.log("Failed to insert role:", insertError.message);
    } else {
      console.log("Successfully inserted master_admin role.");
    }
  }

  // Verify DB state
  const { data: newRoles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  console.log(`master_admin_role_count: ${newRoles?.filter(r => r.role === 'master_admin').length || 0}`);
}

run();
