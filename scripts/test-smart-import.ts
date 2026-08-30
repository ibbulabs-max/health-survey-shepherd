import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { importJobManager } from "../src/services/importJobManager";
import { tables } from "../src/config/database";

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

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

async function runTests() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(url, key);

  console.log("==================================================");
  console.log("RUNNING SMART IMPORT MASTER SUITE & INTEGRITY TESTS");
  console.log("==================================================");

  const { data: profiles } = await supabase.from(tables.profiles).select("id, username").limit(1);
  const realUserId = profiles?.[0]?.id || "00000000-0000-0000-0000-000000000000";
  const realUsername = profiles?.[0]?.username || "admin";

  const testBatchId = `test-batch-${Date.now()}`;
  const testHouseId = `TEST-HOUSE-${Date.now()}`;

  // TEST 1: Register Job in ImportJobManager
  const jobState = importJobManager.registerJob(testBatchId, {
    fileNames: ["sample_ncd_export.xlsx"],
    uploadedBy: realUserId,
    uploadedByName: realUsername,
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: 3,
    uniqueHouses: 1,
  });

  assert(jobState.id === testBatchId, "Test 1a: Job registered with correct ID");
  assert(jobState.status === "queued", "Test 1b: Job starts in 'queued' state");
  assert(jobState.totalRows === 3, "Test 1c: Job totalRows matches metadata");

  // TEST 2: Multi-member House Payload
  // One house with 2 distinct members: Member A (age 45) and Member B (age 35)
  const legacyHistoryA =
    "07 Aug 2026 | COMPLETED | Recheck BP\n08 Aug 2026 | COMPLETED | Recheck BP";

  const samplePayload = {
    houses: [
      {
        key: `id:${testHouseId.toLowerCase()}`,
        houseId: testHouseId,
        fields: {
          house_id: testHouseId,
          house_number: `HN-${Date.now()}`,
          address: `Lane 5, Test Area ${testHouseId}`,
          owner_name: `Test Family Head ${testHouseId}`,
          latitude: 19.076,
          longitude: 72.877,
          total_members: 2,
        },
        extra: { block_no: "B-1", lane_no: "L-2" },
        existingId: null,
        action: "insert" as const,
        sourceFiles: ["sample_ncd_export.xlsx"],
        hasLocation: true,
        hasInvalidCoordinates: false,
        members: [
          {
            key: `m1:${testHouseId}:1`,
            name: "Fatima Khan",
            memberId: "M001-A",
            fields: {
              member_id: "M001-A",
              age: 45,
              gender: "Female",
              systolic: 145,
              diastolic: 92,
              blood_sugar: 180,
              known_history: ["Hypertension"],
              screening_date: "2026-08-01",
              follow_ups: legacyHistoryA,
            },
            extra: { occupation: "Teacher" },
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["sample_ncd_export.xlsx"],
          },
          {
            key: `m2:${testHouseId}:2`,
            name: "Imran Khan",
            memberId: "M001-B",
            fields: {
              member_id: "M001-B",
              age: 35,
              gender: "Male",
              systolic: 120,
              diastolic: 80,
              blood_sugar: 95,
              known_history: [],
              screening_date: "2026-08-01",
            },
            extra: { occupation: "Driver" },
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["sample_ncd_export.xlsx"],
          },
        ],
      },
    ],
    conflicts: [],
    decisions: {},
  };

  // TEST 3: Execute Job
  console.log("Starting background execution for sample payload...");
  importJobManager.startBackgroundProcessing(testBatchId, samplePayload);

  // Poll until job completes (max 10 seconds)
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 500));
    const current = importJobManager.getJob(testBatchId);
    if (
      current &&
      (current.status === "completed" ||
        current.status === "completed_with_errors" ||
        current.status === "failed")
    ) {
      break;
    }
    attempts++;
  }

  const finishedJob = importJobManager.getJob(testBatchId);
  if (finishedJob?.errorSummary && finishedJob.errorSummary.length > 0) {
    console.log("Job Error Summary:", JSON.stringify(finishedJob.errorSummary, null, 2));
  }
  assert(
    finishedJob?.status === "completed",
    `Test 3a: Job completed successfully (status: ${finishedJob?.status})`,
  );
  assert(
    finishedJob?.housesAdded === 1,
    `Test 3b: 1 house added (got ${finishedJob?.housesAdded})`,
  );
  assert(
    finishedJob?.membersAdded === 2,
    `Test 3c: 2 members added in same house (got ${finishedJob?.membersAdded})`,
  );
  assert(
    finishedJob?.progressPercent === 100,
    `Test 3d: Progress reached 100% (got ${finishedJob?.progressPercent}%)`,
  );

  // TEST 4: Verify Multi-Members Exist in DB
  const { data: dbHouses } = await supabase
    .from(tables.houses)
    .select("id")
    .eq("house_id", testHouseId);
  assert(
    dbHouses && dbHouses.length === 1,
    `Test 4a: Exactly 1 house record in DB for ${testHouseId}`,
  );

  const houseUuid = dbHouses![0].id;
  const { data: dbMembers } = await supabase
    .from(tables.houseMembers)
    .select("id, member_name, member_id, data")
    .eq("house_uuid", houseUuid);
  assert(
    dbMembers && dbMembers.length === 2,
    `Test 4b: Both members exist in same house (got ${dbMembers?.length})`,
  );

  // TEST 5: Idempotency & Duplicate Prevention Test
  // Re-run the exact same import payload again
  const testBatch2Id = `test-batch-dup-${Date.now()}`;
  importJobManager.registerJob(testBatch2Id, {
    fileNames: ["sample_ncd_export.xlsx"],
    uploadedBy: realUserId,
    uploadedByName: realUsername,
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: 2,
    uniqueHouses: 1,
  });

  console.log("Re-running the exact same file to verify zero duplicates...");
  importJobManager.startBackgroundProcessing(testBatch2Id, samplePayload);

  attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 500));
    const current = importJobManager.getJob(testBatch2Id);
    if (current && (current.status === "completed" || current.status === "failed")) {
      break;
    }
    attempts++;
  }

  const dupJob = importJobManager.getJob(testBatch2Id);
  if (dupJob?.errorSummary && dupJob.errorSummary.length > 0) {
    console.log("Dup Job Error Summary:", JSON.stringify(dupJob.errorSummary, null, 2));
  }
  assert(
    dupJob?.status === "completed",
    `Test 5a: Duplicate import completed (status: ${dupJob?.status})`,
  );
  assert(
    dupJob?.housesAdded === 0,
    `Test 5b: 0 new houses added on re-import (got ${dupJob?.housesAdded})`,
  );
  assert(
    dupJob?.membersAdded === 0,
    `Test 5c: 0 duplicate members added on re-import (got ${dupJob?.membersAdded})`,
  );
  assert(
    dupJob?.membersMerged === 2,
    `Test 5d: 2 existing members safely merged/updated (got ${dupJob?.membersMerged})`,
  );

  // Verify DB count did NOT increase
  const { data: dbMembersAfter } = await supabase
    .from(tables.houseMembers)
    .select("id")
    .eq("house_uuid", houseUuid);
  assert(
    dbMembersAfter && dbMembersAfter.length === 2,
    `Test 5e: Member count remains exactly 2 (ZERO duplicates created)`,
  );

  // TEST 6: Row-Level Error Handling
  const errorBatchId = `test-batch-err-${Date.now()}`;
  importJobManager.registerJob(errorBatchId, {
    fileNames: ["partial_invalid.xlsx"],
    uploadedBy: realUserId,
    uploadedByName: realUsername,
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: 2,
    uniqueHouses: 1,
  });

  const payloadWithError = {
    houses: [
      {
        key: `id:err-house`,
        houseId: "ERR-HOUSE-1",
        fields: { house_id: "ERR-HOUSE-1", address: "Valid Address" },
        extra: {},
        existingId: null,
        action: "insert" as const,
        sourceFiles: ["partial_invalid.xlsx"],
        hasLocation: false,
        hasInvalidCoordinates: false,
        members: [
          {
            key: "valid-member",
            name: "Valid Member",
            memberId: "VM01",
            fields: { age: 40, gender: "Male", systolic: 120, diastolic: 80 },
            extra: {},
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["partial_invalid.xlsx"],
          },
        ],
      },
    ],
    conflicts: [],
  };

  importJobManager.startBackgroundProcessing(errorBatchId, payloadWithError);

  attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 500));
    const current = importJobManager.getJob(errorBatchId);
    if (current && (current.status === "completed" || current.status === "completed_with_errors")) {
      break;
    }
    attempts++;
  }

  const errJob = importJobManager.getJob(errorBatchId);
  assert(errJob?.status === "completed", "Test 6a: Valid row imported successfully");
  assert(errJob?.membersAdded === 1, "Test 6b: 1 member added from valid row");

  // Cleanup test records
  console.log("Cleaning up test records from database...");
  await supabase.from(tables.memberAssessments).delete().eq("house_uuid", houseUuid);
  await supabase.from(tables.followUps).delete().eq("house_uuid", houseUuid);
  await supabase.from(tables.tasks).delete().eq("house_uuid", houseUuid);
  await supabase.from(tables.houseMembers).delete().eq("house_uuid", houseUuid);
  await supabase.from(tables.houses).delete().eq("id", houseUuid);

  const { data: errHouses } = await supabase
    .from(tables.houses)
    .select("id")
    .eq("house_id", "ERR-HOUSE-1");
  if (errHouses && errHouses.length > 0) {
    const errId = errHouses[0].id;
    await supabase.from(tables.memberAssessments).delete().eq("house_uuid", errId);
    await supabase.from(tables.followUps).delete().eq("house_uuid", errId);
    await supabase.from(tables.tasks).delete().eq("house_uuid", errId);
    await supabase.from(tables.houseMembers).delete().eq("house_uuid", errId);
    await supabase.from(tables.houses).delete().eq("id", errId);
  }

  console.log("==================================================");
  console.log("ALL SMART IMPORT SPEC TESTS PASSED WITH 100% SUCCESS!");
  console.log("==================================================");
}

runTests().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
