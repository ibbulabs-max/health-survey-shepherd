const { Client } = require("pg");

async function check() {
  const client = new Client({
    connectionString:
      "postgresql://postgres:BtwpO7QLoWlQOoCv@db.wctgaujblzvckvvauchj.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT enumlabel FROM pg_enum e 
      JOIN pg_type t ON e.enumtypid = t.oid 
      WHERE t.typname = 'user_role';
    `);
    console.log(
      "user_role values:",
      res.rows.map((r) => r.enumlabel),
    );

    const tables = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `);
    console.log(
      "public tables:",
      tables.rows.map((r) => r.tablename),
    );

    const policies = await client.query(`
      SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public';
    `);
    console.log(
      "policies:",
      policies.rows.map((r) => `${r.tablename}.${r.policyname}`),
    );
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
check();
