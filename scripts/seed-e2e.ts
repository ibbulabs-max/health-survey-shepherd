import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  const adminId = process.env.QA_ADMIN_USER || "e2eadmin";
  const email = `${adminId}@ibbulabs.app`;
  const pin = process.env.QA_PASSWORD || "000000";

  console.log("Checking if e2eadmin exists...");
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError);
    process.exit(1);
  }

  const existing = users.users.find(u => u.email === email);
  let userId = existing?.id;

  if (!existing) {
    console.log("Creating e2eadmin...");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { must_change_pin: false }
    });
    if (error || !data.user) {
      console.error("Failed to create user:", error);
      process.exit(1);
    }
    userId = data.user.id;
  } else {
    console.log("User exists. Resetting PIN...");
    await supabase.auth.admin.updateUserById(existing.id, { password: pin });
  }

  console.log("Setting up profile and role...");
  await supabase.from("profiles").upsert({ id: userId, username: adminId, full_name: "E2E Admin" });
  await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" });

  console.log(`E2E Admin ready: ${adminId} / ${pin}`);
}

seed().catch(console.error);
