import { OfflineSyncService } from "../src/services/offlineSync";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabaseUrl = "https://wctgaujblzvckvvauchj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjdGdhdWpibHp2Y2t2dmF1Y2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ4MDg4OSwiZXhwIjoyMTAzMDU2ODg5fQ.RxARrLcsugcrSe-kxsyOsUMSIIQsakwLZ2i6jDdswW8";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=== TEST 1: Member Payload Sanitization ===");
  const poisonedMemberPayload = {
    id: uuidv4(),
    house_id: uuidv4(),
    created_by: uuidv4(),
    member_id: "MEM-001",
    member_name: "Poisoned Member",
    status: "active", // Should be deleted
    extra_field_1: "should move to data",
    data: {
      clinical_risk: "high",
      eligible: "Yes",
    },
  };

  const sanitizedMember = OfflineSyncService.sanitizeMemberPayload(poisonedMemberPayload);

  if ("status" in sanitizedMember) {
    throw new Error("FAILED: status column still present in sanitized member payload!");
  }
  if ("created_by" in sanitizedMember) {
    throw new Error("FAILED: created_by should be mapped to uploaded_by!");
  }
  if (!sanitizedMember.uploaded_by) {
    throw new Error("FAILED: uploaded_by was not populated from created_by!");
  }
  if ("house_id" in sanitizedMember) {
    throw new Error("FAILED: house_id should be mapped to house_uuid!");
  }
  if (!sanitizedMember.house_uuid) {
    throw new Error("FAILED: house_uuid was not populated from house_id!");
  }
  if (sanitizedMember.data.extra_field_1 !== "should move to data") {
    throw new Error("FAILED: extra field was not moved into data JSONB!");
  }
  console.log(
    "✓ Member payload sanitization PASSED: status stripped, legacy fields mapped, extra fields moved to data",
  );

  console.log("\n=== TEST 2: House Payload Sanitization ===");
  const incompleteHousePayload = {
    id: uuidv4(),
    house_id: "H-999",
    owner_name: "John Doe",
    pin_type: null, // Should default to 'house'
    created_by: null, // Should default to fallback/uploaded_by
    uploaded_by: uuidv4(),
    status: null, // Should default to 'active'
    random_col: "move to data",
  };

  const sanitizedHouse = OfflineSyncService.sanitizeHousePayload(
    incompleteHousePayload,
    "fallback-user-id",
  );

  if (sanitizedHouse.pin_type !== "house") {
    throw new Error(`FAILED: pin_type was expected to be 'house', got: ${sanitizedHouse.pin_type}`);
  }
  if (sanitizedHouse.status !== "active") {
    throw new Error(`FAILED: status was expected to be 'active', got: ${sanitizedHouse.status}`);
  }
  if (!sanitizedHouse.created_by) {
    throw new Error("FAILED: created_by should have been populated!");
  }
  if (sanitizedHouse.data.random_col !== "move to data") {
    throw new Error("FAILED: random_col was not preserved in data JSONB!");
  }
  console.log("✓ House payload sanitization PASSED: pin_type, status, created_by enforced");

  console.log("\n=== TEST 3: Live Supabase Insertion with Sanitized Payloads ===");
  // Fetch a real user ID from profiles table
  const { data: realProfiles } = await supabase.from("profiles").select("id").limit(1);
  const realUserId = realProfiles?.[0]?.id;
  if (!realUserId)
    throw new Error("No user profile found in Supabase database to test created_by constraint!");

  const testHouseUuid = uuidv4();
  const testMemberUuid = uuidv4();

  const liveHousePayload = OfflineSyncService.sanitizeHousePayload({
    id: testHouseUuid,
    house_id: "TEST_H_STAB_01",
    house_number: "123-A",
    address: "Live Test Sector",
    owner_name: "Verification Owner",
    pin_type: null, // Test auto-fix to 'house'
    created_by: realUserId, // Real authenticated profile UUID
    uploaded_by: realUserId,
    data: {
      locality: "Test Ward",
    },
  });

  const liveMemberPayload = OfflineSyncService.sanitizeMemberPayload({
    id: testMemberUuid,
    house_id: testHouseUuid, // Test auto-fix to house_uuid
    member_id: "TEST_M_STAB_01",
    member_name: "Verification Member",
    status: "active", // Test removal of status
    created_by: liveHousePayload.created_by, // Test auto-fix to uploaded_by
    data: {
      age: 50,
      gender: "Male",
      eligible: "Yes",
      clinical_risk: "moderate",
    },
  });

  console.log("\n=== TEST 3: Follow-Up Payload Sanitization ===");
  const poisonedFollowUp = {
    id: uuidv4(),
    house_uuid: testHouseUuid,
    member_uuid: testMemberUuid,
    due_date: "2026-09-20",
    status: "pending",
    reason: "Imported test follow-up",
    notes: "Test note",
    risk_level: "high",
    created_by: realUserId,
    anchor_date: "2026-09-01", // Should be deleted! Not in schema cache
    extra_field_1: "should be deleted",
  };

  const sanitizedFollowUp = OfflineSyncService.sanitizeFollowUpPayload(poisonedFollowUp);
  if ("anchor_date" in sanitizedFollowUp) {
    throw new Error("FAILED: anchor_date still present in sanitized follow_up payload!");
  }
  if ("extra_field_1" in sanitizedFollowUp) {
    throw new Error("FAILED: extra_field_1 still present in sanitized follow_up payload!");
  }
  console.log("✓ Follow-up payload sanitization PASSED: anchor_date and unmapped columns stripped");

  console.log("\n=== TEST 4: Live Supabase Insertion with Sanitized Payloads ===");
  // Insert House
  const { error: houseErr } = await supabase.from("houses").insert(liveHousePayload);
  if (houseErr) {
    throw new Error(`Live House insert failed: ${JSON.stringify(houseErr)}`);
  }
  console.log("✓ Live House insert succeeded without NOT NULL or schema error");

  // Insert Member
  const { error: memberErr } = await supabase.from("house_members").insert(liveMemberPayload);
  if (memberErr) {
    throw new Error(`Live Member insert failed: ${JSON.stringify(memberErr)}`);
  }
  console.log("✓ Live Member insert succeeded without PGRST204 or FK error");

  // Insert Follow-Up
  const testFollowUpUuid = uuidv4();
  const liveFollowUpPayload = OfflineSyncService.sanitizeFollowUpPayload({
    id: testFollowUpUuid,
    house_uuid: testHouseUuid,
    member_uuid: testMemberUuid,
    due_date: "2026-09-20",
    status: "pending",
    reason: "Live Verification Follow-Up",
    risk_level: "moderate",
    created_by: realUserId,
    anchor_date: "2026-09-05", // Test removal of anchor_date
  });

  const { error: followUpErr } = await supabase.from("follow_ups").insert(liveFollowUpPayload);
  if (followUpErr) {
    throw new Error(`Live Follow-up insert failed: ${JSON.stringify(followUpErr)}`);
  }
  console.log("✓ Live Follow-up insert succeeded without PGRST204 or FK error");

  // Verify Rows exist in Supabase
  const { data: verifyHouse } = await supabase
    .from("houses")
    .select("*")
    .eq("id", testHouseUuid)
    .single();
  const { data: verifyMember } = await supabase
    .from("house_members")
    .select("*")
    .eq("id", testMemberUuid)
    .single();
  const { data: verifyFollowUp } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("id", testFollowUpUuid)
    .single();

  if (!verifyHouse) throw new Error("Could not find inserted house in Supabase!");
  if (!verifyMember) throw new Error("Could not find inserted member in Supabase!");
  if (!verifyFollowUp) throw new Error("Could not find inserted follow_up in Supabase!");

  if (verifyMember.member_name !== "Verification Member") {
    throw new Error("Member name does not match inserted value!");
  }
  if (verifyMember.data.clinical_risk !== "moderate") {
    throw new Error("Clinical Risk was not preserved!");
  }
  if (verifyMember.data.eligible !== "Yes") {
    throw new Error("Eligibility was not preserved!");
  }
  console.log(
    "✓ Data verification confirmed: member_name, clinical_risk, eligible, follow_up intact",
  );

  // Cleanup
  await supabase.from("follow_ups").delete().eq("id", testFollowUpUuid);
  await supabase.from("house_members").delete().eq("id", testMemberUuid);
  await supabase.from("houses").delete().eq("id", testHouseUuid);
  console.log("✓ Test records cleaned up successfully");

  console.log("\n=== TEST 5: processImportLocal Batch Queue & Dependency Order ===");
  const { db } = await import("../src/db/schema");

  // In Node environment, mock Dexie tables in-memory so processImportLocal can run
  const inMemoryHouses: any[] = [];
  const inMemoryMembers: any[] = [];
  const inMemoryFollowUps: any[] = [];
  const inMemoryQueue: any[] = [];

  db.houses = {
    add: async (h: any) => {
      inMemoryHouses.push(h);
      return h.id;
    },
    update: async (id: string, h: any) => {
      return 1;
    },
    get: async (id: string) => inMemoryHouses.find((h) => h.id === id),
  } as any;

  db.house_members = {
    add: async (m: any) => {
      inMemoryMembers.push(m);
      return m.id;
    },
    update: async (id: string, m: any) => {
      return 1;
    },
    get: async (id: string) => inMemoryMembers.find((m) => m.id === id),
  } as any;

  db.follow_ups = {
    add: async (f: any) => {
      inMemoryFollowUps.push(f);
      return f.id;
    },
    update: async (id: string, f: any) => {
      return 1;
    },
    get: async (id: string) => inMemoryFollowUps.find((f) => f.id === id),
  } as any;

  db.sync_queue = {
    bulkAdd: async (items: any[]) => {
      inMemoryQueue.push(...items);
      return items.length;
    },
  } as any;

  const { processImportLocal } = await import("../src/services/importLocalProcessor");
  const testPreview: any = {
    totals: { rows: 3 },
    houses: [
      {
        action: "insert",
        key: "H-BATCH-01",
        hasLocation: false,
        sourceFiles: ["Tribal 1.xlsx"],
        fields: {
          house_id: "H-BATCH-01",
          house_number: "10",
          owner_name: "Simulated House 1",
          address: "Tribal Settlement Block A",
        },
        extra: { ward_no: "Ward 4" },
        members: [
          {
            action: "insert",
            key: "M-BATCH-01",
            name: "Member Alpha",
            memberId: "M-01",
            matchConfidence: 1.0,
            sourceFiles: ["Tribal 1.xlsx"],
            fields: {
              age: 42,
              gender: "Female",
              clinical_risk: "HIGH",
              eligible: "Yes",
              survey_date: "2026-08-20",
              follow_ups: "15 Aug 2026 | COMPLETED | Initial Check",
            },
            extra: {},
          },
          {
            action: "insert",
            key: "M-BATCH-02",
            name: "Member Beta",
            memberId: "M-02",
            matchConfidence: 1.0,
            sourceFiles: ["Tribal 1.xlsx"],
            fields: {
              age: 25,
              gender: "Male",
              clinical_risk: "Normal",
              eligible: "No",
            },
            extra: {},
          },
        ],
      },
    ],
  };

  const importResult = await processImportLocal(testPreview, {}, { uploadedBy: realUserId });
  console.log("importResult:", importResult);

  if (importResult.housesAdded !== 1 || importResult.membersAdded !== 2) {
    throw new Error(`processImportLocal counts mismatch: ${JSON.stringify(importResult)}`);
  }
  if (importResult.errors.length > 0) {
    throw new Error(`processImportLocal generated errors: ${JSON.stringify(importResult.errors)}`);
  }
  if (inMemoryFollowUps.length === 0) {
    throw new Error("FAILED: Expected follow-ups to be created for eligible Member Alpha!");
  }

  // Check queue ordering
  const houseQueueIdx = inMemoryQueue.findIndex((q) => q.table === "houses");
  const memberQueueIdx = inMemoryQueue.findIndex((q) => q.table === "house_members");
  const followUpQueueIdx = inMemoryQueue.findIndex((q) => q.table === "follow_ups");

  if (houseQueueIdx === -1 || memberQueueIdx === -1 || followUpQueueIdx === -1) {
    throw new Error("FAILED: Not all tables queued in sync_queue!");
  }

  if (houseQueueIdx >= memberQueueIdx || memberQueueIdx >= followUpQueueIdx) {
    throw new Error(
      `FAILED: Queue ordering violation! houses(${houseQueueIdx}) must precede members(${memberQueueIdx}) and follow_ups(${followUpQueueIdx})`,
    );
  }

  console.log(
    "✓ processImportLocal batch simulation passed with zero errors and strict queue ordering: houses -> house_members -> follow_ups",
  );

  console.log("\nALL OFFLINE SYNC AND SANITIZATION TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
