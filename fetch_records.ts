import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
);

async function run() {
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "id, name, created_at, member_assessments(risk_level, eligible), follow_ups(status, due_date, risk_level)",
    )
    .limit(50);

  if (error) {
    console.error(error);
    return;
  }

  const low = members.find((m) => m.member_assessments?.[0]?.risk_level === "low");
  const mod = members.find((m) => m.member_assessments?.[0]?.risk_level === "moderate");
  const high = members.find((m) => m.member_assessments?.[0]?.risk_level === "high");
  const eligible = members.find((m) => m.member_assessments?.[0]?.eligible === true);

  console.log("LOW:", JSON.stringify(low, null, 2));
  console.log("MODERATE:", JSON.stringify(mod, null, 2));
  console.log("HIGH:", JSON.stringify(high, null, 2));
  console.log("ELIGIBLE:", JSON.stringify(eligible, null, 2));
}

run();
