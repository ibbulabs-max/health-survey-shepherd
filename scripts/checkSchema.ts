import { Client } from "pg";

async function checkSchema() {
  console.log("Checking live schema vs local migrations...");
  const client = new Client({
    connectionString:
      "postgresql://postgres:BtwpO7QLoWlQOoCv@db.wctgaujblzvckvvauchj.supabase.co:5432/postgres",
  });

  await client.connect();

  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN ('houses', 'house_members')
    ORDER BY table_name, column_name;
  `);

  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}
checkSchema();
