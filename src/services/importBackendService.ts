import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import { processImportChunk } from "./processImportChunk";

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
/*                     1. START IMPORT BATCH (CREATE RECORD)                  */
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

    // Return immediately to client to begin chunked uploads
    return {
      success: true,
      batchId,
      status: "processing",
    };
  });

/* -------------------------------------------------------------------------- */
/*                     2. PROCESS A CHUNK OF DATA SYNC                        */
/* -------------------------------------------------------------------------- */

export const processImportChunkFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      batchId: z.string(),
      houses: z.array(houseSchema),
      decisions: z.record(z.enum(["insert", "merge"])).optional(),
      uploadedBy: z.string().nullable().optional(),
      assignedTo: z.string().nullable().optional(),
      supervisorId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { batchId, houses, decisions, uploadedBy, assignedTo, supervisorId } = data;
    const result = await processImportChunk(
      batchId,
      houses,
      decisions,
      uploadedBy,
      assignedTo,
      supervisorId
    );
    return { success: true, result };
  });

/* -------------------------------------------------------------------------- */
/*                     3. FINALIZE BATCH WITH FINAL STATS                     */
/* -------------------------------------------------------------------------- */

export const finalizeImportBatchFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      batchId: z.string(),
      housesAdded: z.number(),
      housesUpdated: z.number(),
      membersAdded: z.number(),
      membersMerged: z.number(),
      conflicts: z.number(),
      hasErrors: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const adminClient = getSupabaseAdmin();
    const finalStatus = data.hasErrors ? "completed_with_errors" : "completed";
    
    await adminClient
      .from(tables.importBatches)
      .update({
        houses_added: data.housesAdded,
        houses_updated: data.housesUpdated,
        members_added: data.membersAdded,
        members_merged: data.membersMerged,
        merged_records: data.membersMerged,
        conflicts: data.conflicts,
        status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.batchId);

    // Fetch the batch to find out who to notify
    const { data: batch } = await adminClient
      .from(tables.importBatches)
      .select("uploaded_by")
      .eq("id", data.batchId)
      .single();

    if (batch?.uploaded_by) {
      await adminClient.from("notifications").insert({
        user_id: batch.uploaded_by,
        title: data.hasErrors ? "Import Completed with Errors" : "Import Completed",
        message: `Your import job finished processing ${data.housesAdded} new houses and ${data.membersAdded} new members.`,
        type: data.hasErrors ? "warning" : "info",
        metadata: { batch_id: data.batchId },
      });
    }

    return { success: true };
  });

/* -------------------------------------------------------------------------- */
/*                     4. GET BATCH LIST OR STATUS                            */
/* -------------------------------------------------------------------------- */

export const getImportBatches = createServerFn({ method: "GET" }).handler(async () => {
  const adminClient = getSupabaseAdmin();
  const { data: batches, error } = await adminClient
    .from(tables.importBatches)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true, batches };
});

export const getImportJobStatus = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string().optional() }))
  .handler(async ({ data: { batchId } }) => {
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
    if (error) throw new Error(error.message);

    if (!batches || batches.length === 0) {
      return { success: false, job: null };
    }

    // Map db record back to a basic format for frontend display
    const dbJob = batches[0];
    return {
      success: true,
      job: {
        batchId: dbJob.id,
        status: dbJob.status,
        fileNames: dbJob.file_names || [],
        uploadedByName: dbJob.uploaded_by_name,
        assignedToName: dbJob.assigned_to_name,
        totalRows: dbJob.total_rows || 0,
        uniqueHouses: dbJob.unique_houses || 0,
        housesUpdated: dbJob.houses_updated || 0,
        housesAdded: dbJob.houses_added || 0,
        membersMerged: dbJob.members_merged || 0,
        membersAdded: dbJob.members_added || 0,
        conflictsCount: dbJob.conflicts || 0,
        failedRows: 0,
        progressPercent: dbJob.status.includes("completed") ? 100 : 0,
        currentStage: dbJob.status,
        createdAt: dbJob.created_at,
        completedAt: dbJob.updated_at,
        errorSummary: [],
      },
    };
  });

export const cancelImportJob = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string() }))
  .handler(async ({ data: { batchId } }) => {
    const adminClient = getSupabaseAdmin();
    const { error } = await adminClient
      .from(tables.importBatches)
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", batchId);
      
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteImportBatch = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string() }))
  .handler(async ({ data: { batchId } }) => {
    const adminClient = getSupabaseAdmin();
    const { error } = await adminClient
      .from(tables.importBatches)
      .delete()
      .eq("id", batchId);
      
    if (error) throw new Error(error.message);
    return { success: true };
  });
