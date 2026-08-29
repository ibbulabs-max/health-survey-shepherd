import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials");
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function userIdToAuthEmail(userId: string): string {
  return `${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}@local.healthsurveyshepherd.com`;
}

async function createUser(userId: string, fullName: string, role: string) {
  console.log(`Creating user: ${userId}`);
  
  // 1. Create in Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: userIdToAuthEmail(userId),
    password: process.env.QA_PASSWORD || "000000",
    email_confirm: true,
    user_metadata: {
      must_change_pin: true,
    },
  });

  if (authError || !authData.user) {
    if (authError?.message.includes("User already registered")) {
      console.log(`User ${userId} already exists.`);
      // Try to change password
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === userIdToAuthEmail(userId));
      if (existingUser) {
        await adminClient.auth.admin.updateUserById(existingUser.id, { password: process.env.QA_NEW_PASSWORD || "000000", user_metadata: { must_change_pin: false } });
        console.log(`Updated password for ${userId} to QA_NEW_PASSWORD`);
      }
      return;
    }
    throw new Error(authError?.message || "Failed to create user in Auth.");
  }

  const newUserId = authData.user.id;

  // 2. Create the profile
  const { error: profileError } = await adminClient.from("profiles").insert({
    id: newUserId,
    username: userId,
    full_name: fullName,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  // 3. Assign role
  const { error: roleError } = await adminClient.from("user_roles").insert({
    user_id: newUserId,
    role: role,
  });

  if (roleError) {
    throw new Error(roleError.message);
  }
  
  // 4. Update password and clear must_change_pin to simulate the password change flow
  await adminClient.auth.admin.updateUserById(newUserId, { password: process.env.QA_NEW_PASSWORD || "000000", user_metadata: { must_change_pin: false } });
  
  console.log(`Successfully created ${userId} and set password`);
}

async function main() {
  await createUser(process.env.QA_SUP_USER || "sup-placeholder", "Supervisor QA", "supervisor");
  await createUser(process.env.QA_CHW_USER || "chw-placeholder", "CHW QA", "survey_user");
  
  // Also reset admin password just in case it's broken
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const adminUser = existingUsers?.users.find(u => u.email === userIdToAuthEmail(process.env.QA_ADMIN_USER || "admin-placeholder"));
  if (adminUser) {
    await adminClient.auth.admin.updateUserById(adminUser.id, { password: process.env.QA_NEW_PASSWORD || "000000", user_metadata: { must_change_pin: false } });
    console.log("Reset Admin password");
  }
}

main().catch(console.error);
