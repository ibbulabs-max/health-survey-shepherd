import { Client } from "pg";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

config(); // Load .env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  await client.connect();
  console.log("Connected to the database.");

  const migrationPath = path.resolve(
    __dirname,
    "../supabase/migrations/20260907000000_strict_rls_and_repairs.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Applying migration: 20260907000000_strict_rls_and_repairs.sql`);

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration applied successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to apply migration:", err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
