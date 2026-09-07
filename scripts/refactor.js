const fs = require("fs");
const path = require("path");

let code = fs.readFileSync("src/services/processImportChunk.ts", "utf8");

// 1. Remove everything up to executeJob
code = code.replace(
  /[\s\S]*?private async executeJob\(batchId: string, payload: JobPayload\) \{/,
  "",
);

// 2. Prepend imports and new function signature
const prefix = `import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import { numberOrNull, toStringArray } from "@/lib/utils";
import { parseLegacyFollowUps, calculateNextFollowUpDate } from "@/lib/followUpEngine";
import type { RiskLevel } from "@/config/risk";

export async function processImportChunk(
  batchId: string,
  houses: any[],
  decisions?: Record<string, any>,
  uploadedBy?: string | null,
  assignedTo?: string | null,
  supervisorId?: string | null
) {
  let housesAdded = 0;
  let housesUpdated = 0;
  let membersAdded = 0;
  let membersMerged = 0;
  const errorSummary: any[] = [];
`;
code = prefix + code;

// 3. Delete initialization variables from executeJob
code = code.replace("const job = this.jobs.get(batchId);", "");
code = code.replace("const ac = this.abortControllers.get(batchId);", "");
code = code.replace("if (!job) return;", "");
code = code.replace('job.status = "processing";', "");
code = code.replace('job.currentStage = "Initializing database connection";', "");
code = code.replace("job.lastHeartbeatAt = new Date().toISOString();", "");
code = code.replace(
  "const adminClient = getSupabaseAdmin();",
  "const adminClient = getSupabaseAdmin();",
);
code = code.replace("const { houses, conflicts, decisions } = payload;", "");

// Replace job accesses
code = code.replace(/job\.supervisorId/g, "supervisorId");
code = code.replace(/job\.assignedTo/g, "assignedTo");
code = code.replace(/job\.uploadedBy/g, "uploadedBy");
code = code.replace(/job\.housesUpdated/g, "housesUpdated");
code = code.replace(/job\.housesAdded/g, "housesAdded");
code = code.replace(/job\.membersMerged/g, "membersMerged");
code = code.replace(/job\.membersAdded/g, "membersAdded");
code = code.replace(/job\.errorSummary/g, "errorSummary");
code = code.replace(/job\.processedRows/g, "0");
code = code.replace(/job\.failedRows/g, "0"); // Just ignore failed rows for finalization
code = code.replace(/job\.currentStage = ".*?";/g, "");
code = code.replace(/job\.lastHeartbeatAt = new Date\(\)\.toISOString\(\);/g, "");

// Remove loop wrapping the whole processing block
code = code.replace("const CHUNK_SIZE = 50;", "");
code = code.replace("const totalHouses = houses.length;", "");
code = code.replace("for (let i = 0; i < totalHouses; i += CHUNK_SIZE) {", "");
code = code.replace("const chunk = houses.slice(i, i + CHUNK_SIZE);", "const chunk = houses;");

// Find the cancellation block and remove it
code = code.replace(/if \(ac\?\.signal\.aborted\) \{[\s\S]*?return;\n      \}/, "");

// The loop ends at:
//       // Update real progress
//       job.progressPercent = Math.min(...);
//     }
// Remove this end of loop block:
code = code.replace(/job\.progressPercent = Math\.min\([\s\S]*?\);\n    \}/, "");

// Handle conflicts at the end
code = code.replace(
  /if \(conflicts && conflicts\.length > 0\) \{[\s\S]*?job\.conflictsCount = conflicts\.length;\n    \}/,
  "",
);

// Remove finalizing logic
code = code.replace(
  /\/\/ 7\. Finalize Job[\s\S]*/,
  `
  return { housesAdded, housesUpdated, membersAdded, membersMerged, errorSummary };
}`,
);

// Save
fs.writeFileSync("src/services/processImportChunk.ts", code, "utf8");
console.log("Refactored successfully.");
