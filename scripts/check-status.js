const { createClient } = require("@supabase/supabase-js");
const s = createClient(
  "https://wctgaujblzvckvvauchj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjdGdhdWpibHp2Y2t2dmF1Y2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ4MDg4OSwiZXhwIjoyMTAzMDU2ODg5fQ.RxARrLcsugcrSe-kxsyOsUMSIIQsakwLZ2i6jDdswW8",
);

async function run() {
  // First, check existing houses in Supabase to see what location_status they currently have!
  const { data: existingHouses } = await s.from("houses").select("location_status").limit(100);
  const distinctExisting = new Set((existingHouses || []).map((h) => h.location_status));
  console.log("Distinct location_status in existing houses table:", Array.from(distinctExisting));

  const testStatuses = [
    "mapped",
    "not_mapped",
    "un_mapped",
    "unknown",
    "none",
    "active",
    "manual",
    "gps",
    "needs_mapping",
    "need_mapping",
    "unlocated",
    "missing",
    "draft",
    "created",
    "not-mapped",
    "un-mapped",
    "unverified",
    "pending_verification",
    "no_location",
    "no-location",
    "without_location",
    "not_located",
  ];

  for (const st of testStatuses) {
    const { error } = await s.from("houses").insert({
      id: require("uuid").v4(),
      created_by: "1923c4dc-5413-4ae4-806c-3b2b3b2eeb21",
      pin_type: "house",
      house_id: "TEST_ST",
      location_status: st,
    });

    if (error && error.message.includes("houses_location_status_check")) {
      // invalid
    } else if (error) {
      console.log("Other error for", st, error.message);
    } else {
      console.log("VALID status:", st);
      await s.from("houses").delete().eq("house_id", "TEST_ST");
    }
  }
}

run();
