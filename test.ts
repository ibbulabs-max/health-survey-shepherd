import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const q = await supabase
    .from("houses")
    .select(
      "id, house_id, house_number, address, owner_name, latitude, longitude, location_status, status, mapped_by, mapped_at, data",
    )
    .limit(1);
  console.log("houses:", q.error);

  const q2 = await supabase
    .from("house_members")
    .select("id, house_uuid, member_id, member_name, data, possible_duplicate")
    .limit(1);
  console.log("house_members:", q2.error);

  const q3 = await supabase
    .from("member_assessments")
    .select(
      "id, house_uuid, member_uuid, systolic, diastolic, blood_sugar, known_history, risk_level, risk_reasons, assessed_at",
    )
    .limit(1);
  console.log("member_assessments:", q3.error);

  const q4 = await supabase
    .from("follow_ups")
    .select(
      "id, house_uuid, member_uuid, due_date, status, reason, notes, risk_level, created_at, completed_at, created_by",
    )
    .limit(1);
  console.log("follow_ups:", q4.error);
}

run();
