import { importJobManager } from "./src/services/importJobManager";
import { readFileSync } from "fs";

async function run() {
  const fileContent = readFileSync("test_followup_import.csv", "utf8");
  const lines = fileContent.split("\n").filter((l) => l.trim().length > 0);
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (parts[i] || "").replace(/^"|"$/g, "").trim();
    });
    return obj;
  });

  const parsedData = rows.map((r, i) => ({
    key: `row-${i}`,
    name: r["Member Name"],
    memberId: r["Member ID"],
    fields: {
      house_id: r["House ID"],
      member_name: r["Member Name"],
      member_id: r["Member ID"],
      age: parseInt(r["Age"] || "0"),
      gender: r["Gender"],
      is_eligible: r["Eligible (≥30)"],
      survey_date: r["Survey Date"],
      clinical_risk: r["Clinical Risk"],
    },
    extra: {
      follow_ups: r["Follow-ups"],
    },
    existingId: null,
    matchConfidence: 0,
    action: "insert" as const,
    sourceFiles: ["test_followup_import.csv"],
  }));

  const housesPayload = parsedData.map((m) => ({
    key: `house-${m.fields.house_id}`,
    houseId: String(m.fields.house_id),
    fields: { house_id: String(m.fields.house_id) },
    extra: {},
    existingId: null,
    action: "insert" as const,
    sourceFiles: ["test_followup_import.csv"],
    hasLocation: false,
    hasInvalidCoordinates: false,
    members: [m],
  }));

  const batchId = "test-batch-" + Date.now();

  importJobManager.registerJob(batchId, {
    fileNames: ["test_followup_import.csv"],
    uploadedBy: "00000000-0000-0000-0000-000000000000",
    uploadedByName: "System",
    assignedTo: null,
    assignedToName: null,
    supervisorId: null,
    totalRows: rows.length,
    uniqueHouses: housesPayload.length,
  });

  console.log("Starting background processing...");
  await (importJobManager as any).executeJob(batchId, {
    houses: housesPayload,
    conflicts: [],
  });

  const job = importJobManager.getJob(batchId);
  console.log("Job status:", job?.status);
  console.log("Job details:", job);
}

run();
