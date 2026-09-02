import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["'](.*)["']$/, "$1");
    process.env[key] = value;
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runReadOnlyAudit() {
  console.log("Checking 'members' vs 'house_members'...");

  const { data: members, error: err1 } = await supabase.from("members").select("*").limit(1);
  if (err1) {
    console.log("public.members error:", err1.message);
  } else {
    console.log("public.members columns:", members ? Object.keys(members[0] || {}) : "No records");
  }
}

runReadOnlyAudit().catch(console.error);
