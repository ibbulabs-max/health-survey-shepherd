require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query("ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'master_admin';");
    console.log("Added master_admin to app_role enum");
  } catch (e) {
    console.error("Failed to add to enum:", e.message);
  } finally {
    await client.end();
  }
}

run();
