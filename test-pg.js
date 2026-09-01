import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:BtwpO7QLoWlQOoCv@db.wctgaujblzvckvvauchj.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query('NOTIFY pgrst, reload_schema;');
  console.log("Notified pgrst");
  
  const res2 = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'health_threshold_settings';");
  console.log("Tables:", res2.rows);

  await client.end();
}
run();
