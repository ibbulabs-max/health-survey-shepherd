import { createClient } from "@supabase/supabase-js";
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

async function run() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(url, key);

  // Test selecting specific fields
  const { data, error } = await supabase
    .from("import_batches")
    .select("processed_rows, current_stage, error_summary, failed_rows")
    .limit(1);
  console.log("Check columns:", { data, error });
}

run().catch(console.error);
