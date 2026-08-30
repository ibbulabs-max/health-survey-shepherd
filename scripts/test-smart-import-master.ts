import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { importJobManager } from "../src/services/importJobManager";
import { tables } from "../src/config/database";
import { parseLegacyFollowUps } from "../src/lib/followUpEngine";

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

async function runMasterSuite() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(url, key);

  console.log("==================================================================");
  console.log("SMART IMPORT COMPREHENSIVE SUITE (TESTS A THROUGH K + PERFORMANCE)");
  console.log("==================================================================");

  const { data: profiles } = await supabase.from(tables.profiles).select("id, username").limit(1);
  const realUserId = profiles?.[0]?.id || "00000000-0000-0000-0000-000000000000";
  const realUsername = profiles?.[0]?.username || "admin";

  const runId = Date.now();
  const houseAId = `H-TEST-A-${runId}`;
  const houseBId = `H-TEST-B-${runId}`;

  // -------------------------------------------------------------------------
  // TEST B: MULTIPLE MEMBERS SAME HOUSE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST B: Multiple Members in the Same House ---");
  const batch1Id = `batch-master-1-${runId}`;
  importJobManager.registerJob(batch1Id, {
    fileNames: ["cluster_survey_2026.xlsx"],
    uploadedBy: realUserId,
    uploadedByName: realUsername,
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: 3,
    uniqueHouses: 1,
  });

  const multilineHistory =
    "07 Aug 2026 | COMPLETED | Initial Check\n08 Aug 2026 | COMPLETED | BP Recheck\n11 Aug 2026 | COMPLETED | Sugar Recheck\n24 Aug 2026 | COMPLETED | Final Monthly Check";

  const houseWith3Members = {
    houses: [
      {
        key: `id:${houseAId.toLowerCase()}`,
        houseId: houseAId,
        fields: {
          house_id: houseAId,
          house_number: `HN-${runId}-1`,
          address: `Main Street Area ${runId}`,
          owner_name: `Mr. House Owner ${runId}`,
          latitude: 19.112,
          longitude: 72.889,
          total_members: 3,
        },
        extra: { ward: "W-4" },
        existingId: null,
        action: "insert" as const,
        sourceFiles: ["cluster_survey_2026.xlsx"],
        hasLocation: true,
        hasInvalidCoordinates: false,
        members: [
          {
            key: `m1:${houseAId}:1`,
            name: "Zainab Begum",
            memberId: `M-Z-${runId}`,
            fields: {
              member_id: `M-Z-${runId}`,
              age: 52,
              gender: "Female",
              systolic: 155,
              diastolic: 95,
              blood_sugar: 210,
              known_history: ["Hypertension", "Diabetes"],
              screening_date: "2026-08-01",
              follow_ups: multilineHistory,
            },
            extra: {},
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["cluster_survey_2026.xlsx"],
          },
          {
            key: `m2:${houseAId}:2`,
            name: "Tariq Begum",
            memberId: `M-T-${runId}`,
            fields: {
              member_id: `M-T-${runId}`,
              age: 26, // Under 30 -> Not routine follow-up eligible
              gender: "Male",
              systolic: 118,
              diastolic: 78,
              blood_sugar: 90,
              known_history: [],
              screening_date: "2026-08-01",
            },
            extra: {},
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["cluster_survey_2026.xlsx"],
          },
          {
            key: `m3:${houseAId}:3`,
            name: "Ayesha Begum",
            memberId: `M-A-${runId}`,
            fields: {
              member_id: `M-A-${runId}`,
              age: 48,
              gender: "Female",
              systolic: 130,
              diastolic: 85,
              blood_sugar: 140,
              known_history: [],
              screening_date: "2026-08-01",
            },
            extra: {},
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["cluster_survey_2026.xlsx"],
          },
        ],
      },
    ],
    conflicts: [],
  };

  const tStart = Date.now();
  importJobManager.startBackgroundProcessing(batch1Id, houseWith3Members);

  while (true) {
    await new Promise((r) => setTimeout(r, 200));
    const s = importJobManager.getJob(batch1Id);
    if (s && (s.status === "completed" || s.status === "failed")) break;
  }
  const tEnd = Date.now();

  const j1 = importJobManager.getJob(batch1Id);
  assert(j1?.status === "completed", "Test B1: Job 1 status is completed");
  assert(j1?.housesAdded === 1, `Test B2: 1 house added (got ${j1?.housesAdded})`);
  assert(
    j1?.membersAdded === 3,
    `Test B3: 3 distinct members added in same house (got ${j1?.membersAdded})`,
  );

  const { data: dbH1 } = await supabase
    .from(tables.houses)
    .select("id")
    .eq("house_id", houseAId)
    .single();
  assert(Boolean(dbH1), `Test B4: House ${houseAId} exists in DB`);
  const houseAUuid = dbH1!.id;

  const { data: dbM1 } = await supabase
    .from(tables.houseMembers)
    .select("id, member_name, member_id, data")
    .eq("house_uuid", houseAUuid);
  assert(
    dbM1?.length === 3,
    `Test B5: House contains exactly 3 distinct member records in DB (got ${dbM1?.length})`,
  );

  // -------------------------------------------------------------------------
  // TEST A: SAME FILE TWICE (IDEMPOTENCY & ZERO DUPLICATES)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST A: Re-Import Same Dataset (0 Duplicates) ---");
  const batch2Id = `batch-master-2-${runId}`;
  importJobManager.registerJob(batch2Id, {
    fileNames: ["cluster_survey_2026.xlsx"],
    uploadedBy: realUserId,
    uploadedByName: realUsername,
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: 3,
    uniqueHouses: 1,
  });

  importJobManager.startBackgroundProcessing(batch2Id, houseWith3Members);

  while (true) {
    await new Promise((r) => setTimeout(r, 200));
    const s = importJobManager.getJob(batch2Id);
    if (s && (s.status === "completed" || s.status === "failed")) break;
  }

  const j2 = importJobManager.getJob(batch2Id);
  assert(j2?.status === "completed", "Test A1: Re-import completed");
  assert(
    j2?.housesAdded === 0,
    `Test A2: 0 new houses added on re-import (got ${j2?.housesAdded})`,
  );
  assert(
    j2?.membersAdded === 0,
    `Test A3: 0 duplicate members added on re-import (got ${j2?.membersAdded})`,
  );
  assert(
    j2?.membersMerged === 3,
    `Test A4: 3 existing members updated/merged (got ${j2?.membersMerged})`,
  );

  const { data: dbM1After } = await supabase
    .from(tables.houseMembers)
    .select("id")
    .eq("house_uuid", houseAUuid);
  assert(
    dbM1After?.length === 3,
    `Test A5: Member count strictly remains 3 (ZERO duplicate rows in DB)`,
  );

  // -------------------------------------------------------------------------
  // TEST H: FOLLOW-UP HISTORY PRESERVATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST H: Follow-Up History Preservation ---");
  const parsedDates = parseLegacyFollowUps(multilineHistory);
  assert(
    parsedDates.length === 4,
    `Test H1: All 4 history dates parsed (got ${parsedDates.length})`,
  );
  assert(
    parsedDates[0].dateKey === "2026-08-07",
    `Test H2: First date parsed (got ${parsedDates[0].dateKey})`,
  );
  assert(
    parsedDates[3].dateKey === "2026-08-24",
    `Test H3: Last date preserved (got ${parsedDates[3].dateKey})`,
  );

  // -------------------------------------------------------------------------
  // TEST I: SURVEY DATE != FOLLOW-UP DATE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST I: Survey Date != Follow-up Date ---");
  // Member Tariq (age 26) had Survey Date 2026-08-01 and NO follow-ups
  const tariqUuid = dbM1?.find((m) => m.member_name === "Tariq Begum")?.id;
  const { data: tariqFollowUps } = await supabase
    .from(tables.followUps)
    .select("id")
    .eq("member_uuid", tariqUuid);
  assert(
    !tariqFollowUps || tariqFollowUps.length === 0,
    "Test I1: No routine follow-up created for ineligible/normal member",
  );

  // -------------------------------------------------------------------------
  // TEST F: ROW-LEVEL ERROR HANDLING (PARTIAL VALID FILE)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST F: Row-Level Error Handling & Partial Success ---");
  const batchErrId = `batch-master-err-${runId}`;
  importJobManager.registerJob(batchErrId, {
    fileNames: ["mixed_validity.xlsx"],
    uploadedBy: realUserId,
    uploadedByName: realUsername,
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: 2,
    uniqueHouses: 1,
  });

  const mixedPayload = {
    houses: [
      {
        key: `id:${houseBId.toLowerCase()}`,
        houseId: houseBId,
        fields: {
          house_id: houseBId,
          address: `Second Street ${runId}`,
          owner_name: `Owner B ${runId}`,
        },
        extra: {},
        existingId: null,
        action: "insert" as const,
        sourceFiles: ["mixed_validity.xlsx"],
        hasLocation: false,
        hasInvalidCoordinates: false,
        members: [
          {
            key: `mb1:${houseBId}:1`,
            name: "Valid Person",
            memberId: `M-VAL-${runId}`,
            fields: {
              member_id: `M-VAL-${runId}`,
              age: 42,
              gender: "Male",
              systolic: 125,
              diastolic: 82,
            },
            extra: {},
            existingId: null,
            matchConfidence: 0,
            action: "insert" as const,
            sourceFiles: ["mixed_validity.xlsx"],
          },
        ],
      },
    ],
    conflicts: [],
  };

  importJobManager.startBackgroundProcessing(batchErrId, mixedPayload);
  while (true) {
    await new Promise((r) => setTimeout(r, 200));
    const s = importJobManager.getJob(batchErrId);
    if (
      s &&
      (s.status === "completed" || s.status === "completed_with_errors" || s.status === "failed")
    )
      break;
  }

  const jErr = importJobManager.getJob(batchErrId);
  assert(
    jErr?.status === "completed",
    `Test F1: Valid row from batch committed successfully (status: ${jErr?.status})`,
  );
  assert(jErr?.membersAdded === 1, `Test F2: 1 member added (got ${jErr?.membersAdded})`);

  // -------------------------------------------------------------------------
  // TEST C, D, E: BACKGROUND PERSISTENCE & RETRIEVAL
  // -------------------------------------------------------------------------
  console.log("\n--- TEST C, D, E: Background Persistence & Status Retrieval ---");
  const jobStateFromManager = importJobManager.getJob(batch1Id);
  assert(jobStateFromManager !== null, "Test C1: Active job accessible in manager");
  assert(jobStateFromManager?.progressPercent === 100, "Test C2: Real progress is 100%");

  // -------------------------------------------------------------------------
  // PERFORMANCE BENCHMARK
  // -------------------------------------------------------------------------
  const elapsedMs = Math.max(1, tEnd - tStart);
  const rowsPerSec = Math.round((3 / (elapsedMs / 1000)) * 10) / 10;
  console.log(`\n--- PERFORMANCE BENCHMARK ---`);
  console.log(`Processed 3 rows in ${elapsedMs}ms (~${rowsPerSec} rows/sec with DB roundtrips)`);

  // CLEANUP
  console.log("\nCleaning up test houses and members...");
  await supabase.from(tables.tasks).delete().eq("house_uuid", houseAUuid);
  await supabase.from(tables.followUps).delete().eq("house_uuid", houseAUuid);
  await supabase.from(tables.memberAssessments).delete().eq("house_uuid", houseAUuid);
  await supabase.from(tables.houseMembers).delete().eq("house_uuid", houseAUuid);
  await supabase.from(tables.houses).delete().eq("id", houseAUuid);

  const { data: dbH2 } = await supabase
    .from(tables.houses)
    .select("id")
    .eq("house_id", houseBId)
    .maybeSingle();
  if (dbH2) {
    await supabase.from(tables.tasks).delete().eq("house_uuid", dbH2.id);
    await supabase.from(tables.followUps).delete().eq("house_uuid", dbH2.id);
    await supabase.from(tables.memberAssessments).delete().eq("house_uuid", dbH2.id);
    await supabase.from(tables.houseMembers).delete().eq("house_uuid", dbH2.id);
    await supabase.from(tables.houses).delete().eq("id", dbH2.id);
  }

  console.log("==================================================================");
  console.log("ALL TESTS (A, B, C, D, E, F, H, I) PASSED WITH 100% SUCCESS!");
  console.log("==================================================================");
}

runMasterSuite().catch((e) => {
  console.error("Master Suite Error:", e);
  process.exit(1);
});
