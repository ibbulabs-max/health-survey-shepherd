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

async function check() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(url, key);

  console.log("Connecting to Supabase at:", url);

  const { data: batches, error: bErr } = await supabase.from("import_batches").select("*").limit(3);
  console.log("Batches count:", batches?.length, "error:", bErr);
  if (batches && batches.length > 0) {
    console.log("Sample batch keys:", Object.keys(batches[0]));
    console.log("Sample batch:", batches[0]);
  }

  const { data: houses } = await supabase.from("houses").select("*").limit(1);
  console.log("Houses columns:", houses && houses[0] ? Object.keys(houses[0]) : "none");

  const { data: members } = await supabase.from("house_members").select("*").limit(1);
  console.log("Members columns:", members && members[0] ? Object.keys(members[0]) : "none");

  const { data: assessments } = await supabase.from("member_assessments").select("*").limit(1);
  console.log(
    "Assessments columns:",
    assessments && assessments[0] ? Object.keys(assessments[0]) : "none",
  );

  const { data: followUps } = await supabase.from("follow_ups").select("*").limit(1);
  console.log("FollowUps columns:", followUps && followUps[0] ? Object.keys(followUps[0]) : "none");

  const { data: tasks } = await supabase.from("tasks").select("*").limit(1);
  console.log("Tasks columns:", tasks && tasks[0] ? Object.keys(tasks[0]) : "none");
}

check().catch(console.error);
