const { Client } = require("pg");

async function run() {
  const client = new Client({
    connectionString:
      "postgresql://postgres:BtwpO7QLoWlQOoCv@db.wctgaujblzvckvvauchj.supabase.co:5432/postgres",
  });
  await client.connect();
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log("Schema cache reloaded.");

  // Create admin-placeholder if it doesn't exist
  // We cannot easily create an auth user via direct DB because of Supabase GoTrue,
  // but we can maybe delete the QA users so the E2E script can recreate them?

  await client.end();
}

run().catch(console.error);
