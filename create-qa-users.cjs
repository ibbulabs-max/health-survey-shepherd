const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

async function createQAUsers() {
  const envFile = fs.readFileSync(".env", "utf8");
  let supabaseUrl = "";
  let serviceRoleKey = "";
  for (const line of envFile.split("\n")) {
    if (line.startsWith("VITE_SUPABASE_URL=")) supabaseUrl = line.split("=")[1].trim();
    if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) serviceRoleKey = line.split("=")[1].trim();
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials in .env");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const usersToCreate = [
    { username: "admin-placeholder", password: "000000", role: "admin" },
    { username: "e2eadmin", password: "123456", role: "admin" },
    { username: "sup-placeholder", password: "000000", role: "supervisor" },
    { username: "chw-placeholder", password: "000000", role: "survey_user" },
  ];

  for (const u of usersToCreate) {
    const email = `${u.username}@ibbulabs.app`;
    console.log(`Ensuring user ${email} exists...`);

    // Check if exists
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error(listError);
      continue;
    }

    let user = users.find((x) => x.email === email);

    if (user) {
      console.log(`User ${email} exists. Resetting password.`);
      await supabase.auth.admin.updateUserById(user.id, { password: u.password });
    } else {
      console.log(`User ${email} does not exist. Creating...`);
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: u.password,
        email_confirm: true,
      });
      if (error) {
        console.error(`Error creating ${email}:`, error);
        continue;
      }
      user = data.user;
    }

    // Set profile and role
    if (user) {
      console.log(`Setting profile and role for ${email}...`);
      await supabase
        .from("profiles")
        .upsert({ id: user.id, username: u.username, full_name: `QA ${u.username}` });
      await supabase.from("user_roles").upsert({ user_id: user.id, role: u.role });
    }
  }

  console.log("Done.");
}

createQAUsers().catch(console.error);
