import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function inject() {
  const houseId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  // 1. Insert House
  await supabase.from("houses").insert({
    id: houseId,
    house_id: "H_TEST_" + Date.now(),
    house_number: "999",
  });

  // 2. Insert Member
  await supabase.from("house_members").insert({
    id: memberId,
    house_uuid: houseId,
    member_name: "Rahul NoHist",
    data: {
      clinical_risk: "high",
      survey_date: "2026-09-01",
      age: 45,
      gender: "Male",
    },
  });

  // 3. Insert Historical Followups (Jane OneHist scenario)
  const memberId2 = crypto.randomUUID();
  await supabase.from("house_members").insert({
    id: memberId2,
    house_uuid: houseId,
    member_name: "Jane OneHist",
    data: {
      clinical_risk: "high",
      survey_date: "2026-09-01",
    },
  });

  await supabase.from("follow_ups").insert({
    member_uuid: memberId2,
    status: "completed",
    due_date: "2026-09-05",
    completed_at: "2026-09-05T12:00:00Z",
    reason: "Routine Follow-up (Historical)",
    type: "Routine",
    priority: "high",
  });

  // And an active one for Jane: 30 days after Sept 5 = Oct 5
  await supabase.from("follow_ups").insert({
    member_uuid: memberId2,
    status: "pending",
    due_date: "2026-10-05",
    reason: "Routine Follow-up",
    type: "Routine",
    priority: "high",
  });

  console.log("Injected mock test records successfully.");
}

inject().catch(console.error);
