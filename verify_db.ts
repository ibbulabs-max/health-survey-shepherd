import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function verify() {
  const { data: members, error: errM } = await supabase
    .from("house_members")
    .select("id, member_name, data")
    .in("member_name", ["Rahul NoHist", "Jane OneHist", "Ahmed MultiHist", "Sara LowRisk"]);

  if (errM) {
    console.error("Member query error:", errM);
    return;
  }

  const { data: jobs, error: errJ } = await supabase
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2);
  console.log("=== LATEST IMPORT JOBS ===");
  console.log(jobs);
  console.log("Error:", errJ);

  console.log("=== MEMBERS ===");
  for (const m of members || []) {
    console.log(`- ${m.member_name} (Risk: ${m.data?.clinical_risk})`);

    const { data: followups, error: errF } = await supabase
      .from("follow_ups")
      .select("status, due_date, completed_at, reason")
      .eq("member_uuid", m.id)
      .order("due_date", { ascending: true });

    if (errF) {
      console.error("  Followups query error:", errF);
      continue;
    }

    if (followups && followups.length > 0) {
      for (const f of followups) {
        console.log(
          `  -> status: ${f.status}, due: ${f.due_date}, completed_at: ${f.completed_at?.split("T")[0] || "null"}, reason: ${f.reason}`,
        );
      }
    } else {
      console.log("  -> (No follow-ups)");
    }
  }
}

verify().catch(console.error);
