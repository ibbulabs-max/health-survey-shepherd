const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const envFile = fs.readFileSync('.env', 'utf8');
  let dbUrl = '';
  for (const line of envFile.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim();
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  let files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  files.sort((a, b) => {
    if (a.includes('create_health_threshold') && b.includes('add_intervals')) return -1;
    if (b.includes('create_health_threshold') && a.includes('add_intervals')) return 1;
    return a.localeCompare(b);
  });

  for (const f of files) {
    console.log('Running', f);
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    try {
      await client.query(sql);
      console.log('Success:', f);
    } catch (e) {
      console.error('Error running', f, e.message);
    }
  }

  try {
     await client.query("NOTIFY pgrst, 'reload schema'");
     console.log('Reloaded schema cache');
  } catch(e) {}

  await client.end();
}

run();
