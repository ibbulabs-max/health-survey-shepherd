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
  console.log("Starting Read-Only Verification...\n");

  // A. follow_ups columns
  const { data: followUpsCols } = await supabase.from("follow_ups").select("*").limit(1);
  console.log(
    "A. follow_ups columns:",
    followUpsCols ? Object.keys(followUpsCols[0] || {}) : "No records",
  );

  // B. health_threshold_settings columns
  const { data: settingsCols } = await supabase
    .from("health_threshold_settings")
    .select("*")
    .limit(1);
  console.log(
    "B. health_threshold_settings columns:",
    settingsCols ? Object.keys(settingsCols[0] || {}) : "No records",
  );

  // C. members.fields structure (house_members data structure)
  const { data: memberCols } = await supabase
    .from("house_members")
    .select("*")
    .not("data", "is", null)
    .limit(1);
  console.log(
    "C. house_members.data keys:",
    memberCols && memberCols[0] ? Object.keys(memberCols[0].data || {}) : "No records",
  );

  // D. house/member relationships
  const { count: houseCount } = await supabase
    .from("houses")
    .select("*", { count: "exact", head: true });
  const { count: memberCount } = await supabase
    .from("house_members")
    .select("*", { count: "exact", head: true });
  console.log(`D. Houses count: ${houseCount}, Members count: ${memberCount}`);

  // E. current clinical_risk values
  const { data: members } = await supabase.from("house_members").select("data");
  const riskCounts: Record<string, number> = {};
  const eligibilityCounts: Record<string, number> = {};

  if (members) {
    for (const m of members) {
      if (m.data) {
        const risk =
          m.data.clinical_risk !== undefined ? String(m.data.clinical_risk) : "undefined";
        riskCounts[risk] = (riskCounts[risk] || 0) + 1;

        const eligible = m.data.eligible !== undefined ? String(m.data.eligible) : "undefined";
        eligibilityCounts[eligible] = (eligibilityCounts[eligible] || 0) + 1;
      }
    }
  }
  console.log("E. Current clinical_risk distinct values:", riskCounts);

  // F. current eligibility values
  console.log("F. Current eligibility distinct values:", eligibilityCounts);

  // G. current follow-up records
  const { count: followUpsCount } = await supabase
    .from("follow_ups")
    .select("*", { count: "exact", head: true });
  console.log("G. Current follow_ups count:", followUpsCount);

  console.log("\nRead-Only Verification Complete.");
}

runReadOnlyAudit().catch(console.error);
