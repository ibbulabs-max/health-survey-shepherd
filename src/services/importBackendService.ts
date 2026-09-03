import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import {
  importJobManager,
  type PreviewHousePayload,
  type PreviewConflictPayload,
  type JobPayload,
} from "@/services/importJobManager";

const memberSchema = z.object({
  key: z.string(),
  name: z.string(),
  memberId: z.string().nullable(),
  fields: z.record(z.unknown()),
  extra: z.record(z.unknown()),
  existingId: z.string().nullable(),
  matchConfidence: z.number(),
  action: z.enum(["insert", "merge", "review"]),
  sourceFiles: z.array(z.string()),
});

const houseSchema = z.object({
  key: z.string(),
  houseId: z.string().nullable(),
  fields: z.record(z.unknown()),
  extra: z.record(z.unknown()),
  existingId: z.string().nullable(),
  action: z.enum(["insert", "merge"]),
  sourceFiles: z.array(z.string()),
  hasLocation: z.boolean(),
  hasInvalidCoordinates: z.boolean(),
  members: z.array(memberSchema),
});

const conflictSchema = z.object({
  entity: z.enum(["house", "member"]),
  houseKey: z.string(),
  memberKey: z.string().optional(),
  label: z.string(),
  field: z.string(),
  existingValue: z.string(),
  newValue: z.string(),
  sourceFile: z.string(),
});

/* -------------------------------------------------------------------------- */
/*                     1. START SERVER BACKGROUND IMPORT JOB                  */
/* -------------------------------------------------------------------------- */

export const startImportJob = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fileNames: z.array(z.string()),
      userId: z.string(),
      username: z.string().nullable(),
      assignedTo: z.string().nullable().optional(),
      assignedToName: z.string().nullable().optional(),
      supervisorId: z.string().nullable().optional(),
      totalRows: z.number(),
      uniqueHouses: z.number(),
      newFields: z.array(z.string()).optional(),
      houses: z.array(houseSchema),
      conflicts: z.array(conflictSchema).optional(),
      decisions: z.record(z.enum(["insert", "merge"])).optional(),
    }),
  )
  .handler(async ({ data: payload }) => {
    const adminClient = getSupabaseAdmin();
    const {
      fileNames,
      userId,
      username,
      assignedTo,
      assignedToName,
      supervisorId,
      totalRows,
      uniqueHouses,
      newFields,
      houses,
      conflicts,
      decisions,
    } = payload;

    // 1. Create the persistent batch record in Supabase
    const { data: batch, error: batchError } = await adminClient
      .from(tables.importBatches)
      .insert({
        file_names: fileNames,
        uploaded_by: userId,
        uploaded_by_name: username,
        assigned_to: assignedTo ?? null,
        assigned_to_name: assignedToName ?? null,
        supervisor_id: supervisorId ?? null,
        total_rows: totalRows,
        unique_houses: uniqueHouses,
        new_fields: newFields ?? [],
        status: "processing",
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Failed to create import batch record");
    }

    const batchId = batch.id;

    // 2. Register job in server-side singleton manager
    importJobManager.registerJob(batchId, {
      fileNames,
      uploadedBy: userId,
      uploadedByName: username,
      assignedTo: assignedTo ?? null,
      assignedToName: assignedToName ?? null,
      supervisorId: supervisorId ?? null,
      totalRows,
      uniqueHouses,
    });

    // 3. Trigger background worker execution (detached from HTTP response)
    const jobPayload: JobPayload = {
      houses: houses as PreviewHousePayload[],
      conflicts: (conflicts || []) as PreviewConflictPayload[],
      decisions: decisions ?? undefined,
      newFields: newFields ?? undefined,
    };

    importJobManager.startBackgroundProcessing(batchId, jobPayload);

    // Return immediately to client
    return {
      success: true,
      batchId,
      status: "processing",
    };
  });

/* -------------------------------------------------------------------------- */
/*                     2. GET IMPORT JOB STATUS & PROGRESS                    */
/* -------------------------------------------------------------------------- */

export const getImportJobStatus = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string().optional() }))
  .handler(async ({ data: { batchId } }) => {
    // 1. Check in-memory active job first
    if (batchId) {
      const memJob = importJobManager.getJob(batchId);
      if (memJob) {
        return { success: true, job: memJob };
      }
    } else {
      const activeJob = importJobManager.getActiveJob();
      if (activeJob) {
        return { success: true, job: activeJob };
      }
    }

    // 2. Fallback query from Supabase database
    const adminClient = getSupabaseAdmin();
    let query = adminClient
      .from(tables.importBatches)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (batchId) {
      query = adminClient.from(tables.importBatches).select("*").eq("id", batchId).limit(1);
    }

    const { data: batches, error } = await query;
    if (error || !batches || batches.length === 0) {
      return { success: false, job: null };
    }

    const b = batches[0];
    const isCompleted = b.status === "completed";
    const isFailed = b.status === "failed";
    const isProcessing = b.status === "processing";

    const total = b.total_rows || 1;
    const processed = isCompleted ? total : 0;
    const percent = isCompleted ? 100 : isProcessing ? 50 : 0;

    return {
      success: true,
      job: {
        id: b.id,
        fileNames: Array.isArray(b.file_names) ? b.file_names : [],
        uploadedBy: b.uploaded_by,
        uploadedByName: b.uploaded_by_name,
        assignedTo: b.assigned_to,
        assignedToName: b.assigned_to_name,
        supervisorId: b.supervisor_id,
        status: b.status || "completed",
        currentStage: isCompleted
          ? "Completed"
          : isProcessing
            ? "Processing"
            : b.status || "Unknown",
        totalRows: total,
        processedRows: processed,
        housesAdded: b.houses_added || 0,
        housesUpdated: b.houses_updated || 0,
        membersAdded: b.members_added || 0,
        membersMerged: b.members_merged || b.merged_records || 0,
        failedRows: 0,
        conflictsCount: b.conflicts || 0,
        progressPercent: percent,
        errorSummary: [],
        startedAt: b.created_at,
        completedAt: isCompleted ? b.updated_at : null,
        lastHeartbeatAt: b.updated_at || b.created_at,
      },
    };
  });

/* -------------------------------------------------------------------------- */
/*                     3. CANCEL RUNNING IMPORT JOB                           */
/* -------------------------------------------------------------------------- */

export const cancelImportJob = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string() }))
  .handler(async ({ data: { batchId } }) => {
    const cancelled = importJobManager.cancelJob(batchId);
    const adminClient = getSupabaseAdmin();
    await adminClient
      .from(tables.importBatches)
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", batchId);

    return { success: true, cancelled };
  });

/* -------------------------------------------------------------------------- */
/*                     4. DELETE IMPORT BATCH (PRESERVED)                     */
/* -------------------------------------------------------------------------- */

export const deleteImportBatch = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string() }))
  .handler(async ({ data: { batchId } }) => {
    const adminClient = getSupabaseAdmin();

    const { data: batch, error: bError } = await adminClient
      .from(tables.importBatches)
      .select("file_names")
      .eq("id", batchId)
      .single();

    if (bError || !batch) throw new Error("Batch not found.");

    const files = Array.isArray(batch.file_names) ? batch.file_names : [];
    if (!files.length) throw new Error("No files in batch.");

    let membersDeleted = 0;
    let housesDeleted = 0;

    for (const filename of files) {
      // 1. Members
      const { data: members, error: mError } = await adminClient
        .from(tables.houseMembers)
        .select("id, source_files")
        .contains("source_files", JSON.stringify([filename]));

      if (mError) throw mError;

      for (const member of members || []) {
        if (member.source_files.length === 1) {
          await adminClient.from(tables.memberAssessments).delete().eq("member_uuid", member.id);
          await adminClient.from(tables.followUps).delete().eq("member_uuid", member.id);
          await adminClient.from(tables.houseMembers).delete().eq("id", member.id);
          membersDeleted++;
        } else {
          const newSources = member.source_files.filter((f: string) => f !== filename);
          await adminClient
            .from(tables.houseMembers)
            .update({ source_files: newSources })
            .eq("id", member.id);
        }
      }

      // 2. Houses
      const { data: houses, error: hError } = await adminClient
        .from(tables.houses)
        .select("id, source_files")
        .contains("source_files", JSON.stringify([filename]));

      if (hError) throw hError;

      for (const house of houses || []) {
        if (house.source_files.length === 1) {
          await adminClient.from(tables.houses).delete().eq("id", house.id);
          housesDeleted++;
        } else {
          const newSources = house.source_files.filter((f: string) => f !== filename);
          await adminClient
            .from(tables.houses)
            .update({ source_files: newSources })
            .eq("id", house.id);
        }
      }
    }

    await adminClient.from(tables.importConflicts).delete().eq("batch_id", batchId);
    await adminClient
      .from(tables.importBatches)
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", batchId);

    return { success: true, housesDeleted, membersDeleted };
  });

/* -------------------------------------------------------------------------- */
/*                     5. TRANSFER IMPORT BATCH (PRESERVED)                   */
/* -------------------------------------------------------------------------- */

export const transferImportBatch = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string(), newAssigneeId: z.string().nullable() }))
  .handler(async ({ data: { batchId, newAssigneeId } }) => {
    const adminClient = getSupabaseAdmin();

    const { data: batch, error: bError } = await adminClient
      .from(tables.importBatches)
      .select("file_names, assigned_to")
      .eq("id", batchId)
      .single();

    if (bError) throw bError;

    const files = Array.isArray(batch.file_names) ? batch.file_names : [];
    if (!files.length) throw new Error("No files found in batch.");

    let assignedToName = null;
    let supervisorId = null;

    if (newAssigneeId) {
      const { data: profile } = await adminClient
        .from(tables.profiles)
        .select("full_name, username")
        .eq("id", newAssigneeId)
        .single();
      assignedToName = profile?.full_name || profile?.username || null;

      const { data: membership } = await adminClient
        .from(tables.teamMemberships)
        .select("supervisor_id")
        .eq("csw_id", newAssigneeId)
        .eq("status", "active")
        .maybeSingle();
      if (membership) {
        supervisorId = membership.supervisor_id;
      }
    }

    await adminClient
      .from(tables.importBatches)
      .update({
        assigned_to: newAssigneeId,
        assigned_to_name: assignedToName,
        supervisor_id: supervisorId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    for (const file of files) {
      await adminClient
        .from(tables.houses)
        .update({ assigned_csw_id: newAssigneeId, supervisor_id: supervisorId })
        .contains("source_files", JSON.stringify([file]));
    }

    return { success: true };
  });
