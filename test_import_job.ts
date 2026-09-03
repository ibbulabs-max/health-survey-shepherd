import { createClient } from "@supabase/supabase-js";
import { importJobManager } from "./src/services/importJobManager";
import crypto from "crypto";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testImport() {
  const manager = importJobManager;

  const houseId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  // First create the house and member so the foreign keys work
  const supabase = createClient(url, key);
  const { data: users } = await supabase.from("team_memberships").select("csw_id").limit(1);
  const validUserId = users?.[0]?.csw_id || null;

  await supabase.from("houses").insert({
    id: houseId,
    house_id: "TEST_H1",
    house_number: "1",
    created_by: validUserId,
  });

  await supabase.from("house_members").insert({
    id: memberId,
    house_uuid: houseId,
    member_id: "M1",
    member_name: "Test Member History",
    data: {
      survey_date: "2026-09-01",
      eligible: "Yes",
      clinical_risk: "high",
      follow_ups: "10 Sep 2026",
    },
  });

  const housePayload = {
    houseId: "TEST_H1",
    houseNumber: "1",
    dbId: houseId,
    fields: {
      house_id: "TEST_H1",
      house_number: "1",
    },
    members: [
      {
        memberId: "M1",
        name: "Test Member History",
        existingId: memberId,
        fields: {
          survey_date: "2026-09-01",
          eligible: "Yes",
          clinical_risk: "high",
          follow_ups: "10 Sep 2026",
        },
        extra: {
          eligible: "Yes",
          clinical_risk: "high",
          follow_ups: "10 Sep 2026",
        },
        action: "merge",
      },
    ],
  };

  const batchId = crypto.randomUUID();
  manager.jobs.set(batchId, {
    id: batchId,
    fileNames: ["test.csv"],
    uploadedBy: validUserId,
    uploadedByName: "Test",
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    status: "processing",
    currentStage: "init",
    totalRows: 1,
    processedRows: 0,
    housesAdded: 0,
    housesUpdated: 0,
    membersAdded: 0,
    membersMerged: 0,
    failedRows: 0,
    conflictsCount: 0,
    progressPercent: 0,
    errorSummary: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastHeartbeatAt: new Date().toISOString(),
  });

  console.log("Starting first import...");
  try {
    await (manager as any).executeJob(batchId, {
      houses: [housePayload as any],
      conflicts: [],
      decisions: {},
    });
  } catch (err) {
    console.error("Error executing first job:", err);
  }

  console.log("Starting SECOND import (re-import)...");
  const batchId2 = crypto.randomUUID();
  manager.jobs.set(batchId2, {
    id: batchId2,
    fileNames: ["test.csv"],
    uploadedBy: validUserId,
    uploadedByName: "Test",
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    status: "processing",
    currentStage: "init",
    totalRows: 1,
    processedRows: 0,
    housesAdded: 0,
    housesUpdated: 0,
    membersAdded: 0,
    membersMerged: 0,
    failedRows: 0,
    conflictsCount: 0,
    progressPercent: 0,
    errorSummary: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastHeartbeatAt: new Date().toISOString(),
  });

  try {
    await (manager as any).executeJob(batchId2, {
      houses: [housePayload as any],
      conflicts: [],
      decisions: {},
    });
  } catch (err) {
    console.error("Error executing second job:", err);
  }

  console.log("Import finished. Let's check the database.");

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("member_uuid", memberId)
    .order("status");
  console.log("Follow-ups created:");
  followUps?.forEach((f) => console.log(f.status, f.due_date, f.completed_at));
}

testImport().catch(console.error);
