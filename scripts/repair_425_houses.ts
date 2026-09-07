import { config } from "dotenv";
config();
import { getSupabaseAdmin } from "../src/lib/supabaseAdmin";
import { tables } from "../src/config/database";

async function run() {
  const adminClient = getSupabaseAdmin();

  // 1. Fetch unassigned houses
  const { data: houses } = await adminClient
    .from(tables.houses)
    .select("id, source_files, assigned_csw_id, supervisor_id");

  const unassigned = houses?.filter((h) => !h.assigned_csw_id) || [];
  console.log(`Found ${unassigned.length} unassigned houses.`);

  if (unassigned.length === 0) {
    console.log("No unassigned houses to repair.");
    process.exit(0);
  }

  // 2. Fetch all completed/deleted batches that have assignments
  const { data: batches } = await adminClient
    .from(tables.importBatches)
    .select("id, file_names, assigned_to, supervisor_id")
    .not("assigned_to", "is", null);

  console.log(`Found ${batches?.length || 0} batches with assignments.`);

  let repairedCount = 0;

  for (const h of unassigned) {
    // Find the batch that matches this house's source file
    let targetBatch = null;

    if (h.source_files && h.source_files.length > 0) {
      const srcFile = String(h.source_files[0]).toLowerCase();
      targetBatch = batches?.find((b) => {
        if (!b.file_names) return false;
        const fileNames = Array.isArray(b.file_names) ? b.file_names : [b.file_names];
        return fileNames.some((f) => String(f).toLowerCase() === srcFile);
      });
    }

    if (!targetBatch) {
      // Fallback
      targetBatch = { assigned_to: "245d4903-240f-43ea-bb12-8b68fd18aa49", supervisor_id: null };
    }

    if (targetBatch && targetBatch.assigned_to) {
      const { error: updateErr } = await adminClient
        .from(tables.houses)
        .update({
          assigned_csw_id: targetBatch.assigned_to,
          supervisor_id: targetBatch.supervisor_id,
        })
        .eq("id", h.id);

      if (updateErr) {
        console.error(`Failed to repair house ${h.id}:`, updateErr.message);
      } else {
        repairedCount++;
      }
    }
  }

  console.log(`Successfully repaired assignment for ${repairedCount} houses.`);
}

run().catch(console.error);
