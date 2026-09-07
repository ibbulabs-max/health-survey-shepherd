const fs = require("fs");
let code = fs.readFileSync("src/services/processImportChunk.ts", "utf8");

// Remove the top interface ImportJobState
code = code.replace(/export interface ImportJobState \{[\s\S]*?\}\n/, "");
code = code.replace(/export interface JobPayload \{[\s\S]*?\}\n/, "");

// Replace class start
code = code.replace(
  /\/\*\*[\s\S]*?class ImportJobManager \{[\s\S]*?private async executeJob\(batchId: string, payload: JobPayload\) \{/m,
  `export async function processImportChunk(
  batchId: string,
  houses: PreviewHousePayload[],
  decisions?: Record<string, "insert" | "merge">,
  uploadedBy?: string | null,
  assignedTo?: string | null,
  supervisorId?: string | null
) {
  const adminClient = getSupabaseAdmin();
  const result = {
    housesAdded: 0,
    housesUpdated: 0,
    membersAdded: 0,
    membersMerged: 0,
    errorSummary: [] as Array<{row: number, item: string, error: string}>
  };`,
);

// Clean up job references
code = code.replace(
  /const job = this\.jobs\.get\(batchId\);\n\s*const ac = this\.abortControllers\.get\(batchId\);\n\s*if \(!job\) return;/g,
  "",
);
code = code.replace(/job\.status = .*?;/g, "");
code = code.replace(/job\.currentStage = .*?;/g, "");
code = code.replace(/job\.lastHeartbeatAt = .*?;/g, "");
code = code.replace(/job\.completedAt = .*?;/g, "");
code = code.replace(/job\.progressPercent = .*?;/g, "");
code = code.replace(/const \{ houses, conflicts, decisions \} = payload;/g, "");

code = code.replace(/job\.supervisorId/g, "supervisorId");
code = code.replace(/job\.assignedTo/g, "assignedTo");
code = code.replace(/job\.uploadedBy/g, "uploadedBy");

code = code.replace(/job\.housesUpdated/g, "result.housesUpdated");
code = code.replace(/job\.housesAdded/g, "result.housesAdded");
code = code.replace(/job\.membersMerged/g, "result.membersMerged");
code = code.replace(/job\.membersAdded/g, "result.membersAdded");
code = code.replace(/job\.errorSummary/g, "result.errorSummary");

code = code.replace(/job\.processedRows \+= .*?;/g, "");
code = code.replace(/job\.failedRows \+= .*?;/g, "");
code = code.replace(/job\.processedRows/g, "0");
code = code.replace(/job\.failedRows/g, "0");
code = code.replace(/job\.totalRows/g, "0");

code = code.replace(/if \(ac\?\.signal\.aborted\) \{[\s\S]*?return;\n\s*\}/m, "");

// Clean up conflicts recording - now done in backend service or client side, not here.
code = code.replace(
  /\/\/ 6\. Record conflicts if any[\s\S]*?\/\/ 7\. Finalize Job/m,
  "// 7. Finalize Job",
);

// Fix return
code = code.replace(/\/\/ 7\. Finalize Job[\s\S]*?\}\n\}/m, "return result;\n}");

// Remove singleton
code = code.replace(/\/\/ Global Singleton Instance[\s\S]*$/m, "");

fs.writeFileSync("src/services/processImportChunk.ts", code);
console.log("Rewrite successful!");
