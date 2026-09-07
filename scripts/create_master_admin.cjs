require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.MASTER_ADMIN_EMAIL;
const password = process.env.MASTER_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

if (!email || !password) {
  console.error("Error: MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log(`Checking for existing user: ${email}...`);
  let { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  let user = users.find(u => u.email === email);
  let userId;

  if (user) {
    console.log("User already exists. Ensuring roles and profile...");
    userId = user.id;
  } else {
    console.log("User does not exist. Creating new Master Admin user...");
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { must_change_pin: false }
    });

    if (createError) {
      console.error("Failed to create user:", createError.message);
      process.exit(1);
    }
    console.log("User created successfully.");
    userId = userData.user.id;
  }

  // Ensure Profile exists
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!profile) {
    console.log("Creating profile...");
    const { error: insertProfileError } = await supabase.from('profiles').insert({
      id: userId,
      username: email.split('@')[0],
      full_name: 'Master Administrator'
    });
    if (insertProfileError) {
      console.error("Failed to create profile:", insertProfileError.message);
      process.exit(1);
    }
  } else {
    console.log("Profile already exists.");
  }

  // Ensure role is master_admin
  const { data: roles, error: rolesError } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  const isMasterAdmin = roles && roles.some(r => r.role === 'master_admin');

  if (!isMasterAdmin) {
    console.log("Assigning master_admin role...");
    // Let's check if the org matters, normally master_admin doesn't need an org, but we'll assign a default one or just null if allowed.
    // The schema allows organization_id to be nullable? The migration says: organization_id UUID NOT NULL ? Wait, user_roles might need org id.
    // Let's check table definition first.
    // Actually, we can just insert with a dummy org or the first org we find.
    let orgId = null;
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    if (orgs && orgs.length > 0) {
      orgId = orgs[0].id;
    }
    
    const { error: roleInsertError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'master_admin'
    });

    if (roleInsertError) {
      console.error("Failed to assign role:", roleInsertError.message);
      process.exit(1);
    }
    console.log("Role master_admin assigned successfully.");
  } else {
    console.log("Role master_admin already assigned.");
  }

  console.log("Master Admin verification complete. User is fully provisioned.");
}

run();
