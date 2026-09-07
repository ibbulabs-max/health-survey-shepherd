import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
        process.env[key] = value;
      }
    }
  }
}

async function runSQL() {
  loadEnv();
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error("No DATABASE_URL found. Cannot apply migration.");
    return;
  }

  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error("Please provide a SQL file path as an argument.");
    return;
  }

  const sql = fs.readFileSync(path.resolve(process.cwd(), sqlFile), "utf-8");

  const client = new Client({ connectionString: connStr });
  await client.connect();

  console.log(`Applying SQL from ${sqlFile}...`);
  try {
    await client.query(sql);
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Error applying migration:", err);
  } finally {
    await client.end();
  }
}

runSQL().catch(console.error);
