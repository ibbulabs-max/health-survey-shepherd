import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import { calculateRisk, toStringArray, numberOrNull } from "@/lib/domain";
import type { RiskLevel } from "@/config/risk";

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
  members: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      memberId: z.string().nullable(),
      fields: z.record(z.unknown()),
      extra: z.record(z.unknown()),
      existingId: z.string().nullable(),
      matchConfidence: z.number(),
      action: z.enum(["insert", "merge", "review"]),
      sourceFiles: z.array(z.string()),
    })
  ),
});

export const commitImportChunk = createServerFn({ method: "POST" })
  .validator(
    z.object({
      batchId: z.string(),
      houses: z.array(houseSchema),
      decisions: z.record(z.enum(["insert", "merge"])).optional(),
      userId: z.string(),
      assignedTo: z.string().nullable().optional(),
      supervisorId: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data: payload }) => {
    const adminClient = getSupabaseAdmin();
    const { batchId, houses, decisions, userId, assignedTo, supervisorId } = payload;

    let actualSupervisorId = supervisorId ?? null;
    if (assignedTo && !actualSupervisorId) {
      const { data: membership } = await adminClient
        .from(tables.teamMemberships)
        .select("supervisor_id")
        .eq("csw_id", assignedTo)
        .eq("status", "active")
        .maybeSingle();
      if (membership) {
        actualSupervisorId = membership.supervisor_id;
      }
    }

    let housesAdded = 0;
    let housesUpdated = 0;
    let membersAdded = 0;
    let membersMerged = 0;
    let followUpsScheduled = 0;

    const { nextDueDate } = await import("@/config/followups");

    for (const house of houses) {
      const latRaw = house.fields["latitude"];
      const lngRaw = house.fields["longitude"];
      const lat = numberOrNull(latRaw);
      const lng = numberOrNull(lngRaw);
      
      const validLat = lat != null && lat >= -90 && lat <= 90 ? lat : null;
      const validLng = lng != null && lng >= -180 && lng <= 180 ? lng : null;

      const locationStatus = validLat != null && validLng != null ? "mapped" : "not_mapped";

      const housePayload = {
        house_id: house.fields["house_id"]?.toString() ?? null,
        house_number: house.fields["house_number"]?.toString() ?? null,
        address: house.fields["address"]?.toString() ?? null,
        owner_name: house.fields["owner_name"]?.toString() ?? null,
        total_members: numberOrNull(house.fields["total_members"]),
        latitude: validLat,
        longitude: validLng,
        location_status: locationStatus,
        location_source: validLat != null && validLng != null ? "import" : null,
        pin_type: "house",
        data: house.extra as Record<string, any>,
        source_files: house.sourceFiles,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString(),
        assigned_csw_id: assignedTo ?? null,
        supervisor_id: actualSupervisorId,
      };

      let houseUuid = house.existingId;
      if (houseUuid) {
        const clean = Object.fromEntries(Object.entries(housePayload).filter(([, v]) => v != null));
        const { error } = await adminClient.from(tables.houses).update(clean).eq("id", houseUuid);
        if (error) throw error;
        housesUpdated += 1;
      } else {
        const { data, error } = await adminClient
          .from(tables.houses)
          .insert({ ...housePayload, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        houseUuid = data.id;
        housesAdded += 1;
      }

      for (const member of house.members) {
        const decision = decisions?.[member.key];
        const action = member.action === "review" ? (decision ?? "insert") : member.action;
        
        // Deep field merge strategy
        const newFieldsAndExtra = { ...member.fields, ...member.extra } as Record<string, any>;

        let memberUuid: string | null = null;

        if (action === "merge" && member.existingId) {
          const { data: existing } = await adminClient
            .from(tables.houseMembers)
            .select("data")
            .eq("id", member.existingId)
            .maybeSingle();
            
          const existingData = (existing?.data ?? {}) as Record<string, any>;
          // Retain existing valid values over empty new values
          const merged = { ...existingData };
          for (const [k, v] of Object.entries(newFieldsAndExtra)) {
            if (v != null && v !== "") {
              merged[k] = v;
            }
          }

          const { error } = await adminClient
            .from(tables.houseMembers)
            .update({
              member_name: member.name,
              data: merged,
              source_files: member.sourceFiles,
              possible_duplicate: member.matchConfidence < 0.95,
              updated_at: new Date().toISOString(),
            })
            .eq("id", member.existingId);
          if (error) throw error;
          memberUuid = member.existingId;
          membersMerged += 1;
        } else {
          const { data: inserted, error } = await adminClient
            .from(tables.houseMembers)
            .insert({
              house_uuid: houseUuid,
              member_id: member.memberId,
              member_name: member.name,
              data: newFieldsAndExtra,
              source_files: member.sourceFiles,
              uploaded_by: userId,
              uploaded_at: new Date().toISOString(),
              possible_duplicate: member.action === "review",
            })
            .select("id")
            .single();
          if (error) throw error;
          memberUuid = inserted.id;
          membersAdded += 1;
        }

        // Generate automatic follow-up and assessment from survey date
        if (memberUuid && houseUuid) {
          const screeningDateRaw = member.fields["screening_date"];
          const surveyDate = screeningDateRaw ? new Date(String(screeningDateRaw)) : new Date();

          const systolic = numberOrNull(member.fields["systolic"]);
          const diastolic = numberOrNull(member.fields["diastolic"]);
          const bloodSugar = numberOrNull(member.fields["blood_sugar"]);
          const conditions = toStringArray(member.fields["known_history"]);
          const riskResult = calculateRisk({ systolic, diastolic, bloodSugar, conditions });
          const risk: RiskLevel = riskResult.level;

          const hasAssessmentData = systolic != null || diastolic != null || bloodSugar != null || conditions.length > 0;

          try {
            if (hasAssessmentData) {
              await adminClient.from(tables.memberAssessments).insert({
                house_uuid: houseUuid,
                member_uuid: memberUuid,
                systolic,
                diastolic,
                blood_sugar: bloodSugar,
                known_history: conditions,
                risk_level: risk,
                risk_reasons: riskResult.reasons,
                assessed_by: userId,
                assessed_at: surveyDate.toISOString(),
                available: true,
                referral_needed: false
              });

              const { data: currentMember } = await adminClient
                .from(tables.houseMembers)
                .select("data")
                .eq("id", memberUuid)
                .single();
              const finalData = (currentMember?.data ?? {}) as Record<string, any>;
              const age = numberOrNull(finalData["age"] ?? member.fields["age"]);
              const isEligible = age != null && age >= 30;

              if (isEligible) {
                // Check for existing completed follow-ups to base the next date on
                const { data: completedFollowUps } = await adminClient
                  .from(tables.followUps)
                  .select("due_date, updated_at")
                  .eq("member_uuid", memberUuid)
                  .eq("status", "completed")
                  .order("updated_at", { ascending: false })
                  .limit(1);
                  
                const lastCompleted = completedFollowUps?.[0];
                const followUpCountStr = member.fields["follow_ups"];
                const parsedCount = numberOrNull(followUpCountStr);
                
                let baseDateForNext = surveyDate;
                
                if (lastCompleted && lastCompleted.updated_at) {
                  baseDateForNext = new Date(lastCompleted.updated_at);
                } else if (parsedCount && parsedCount > 0) {
                   // If excel says they completed N follow-ups but we don't have them in DB, 
                   // we project the base date for the Nth completion.
                   const { followUpConfig } = await import("@/config/followups");
                   const interval = followUpConfig.intervalDays[risk];
                   const simulatedLastCompletion = new Date(surveyDate);
                   simulatedLastCompletion.setDate(simulatedLastCompletion.getDate() + (parsedCount * interval));
                   baseDateForNext = simulatedLastCompletion;
                }

                // Check if a pending follow-up already exists that is far in the future
                const { data: existingPending } = await adminClient.from(tables.followUps)
                  .select("id, due_date")
                  .eq("member_uuid", memberUuid)
                  .eq("status", "pending")
                  .maybeSingle();

                const nextTargetDate = nextDueDate(baseDateForNext, risk);
                const nextTargetDateStr = nextTargetDate.toISOString().split('T')[0];

                if (existingPending) {
                   // Update existing instead of deleting to preserve ID and not duplicate
                   await adminClient.from(tables.followUps).update({
                     due_date: nextTargetDateStr,
                     risk_level: risk,
                     reason: `Imported screening ${risk} risk follow-up`,
                     updated_at: new Date().toISOString()
                   }).eq("id", existingPending.id);
                   // We don't increment followUpsScheduled since it was just updated
                } else {
                   // Insert new pending follow-up
                   await adminClient.from(tables.followUps).insert({
                     house_uuid: houseUuid,
                     member_uuid: memberUuid,
                     due_date: nextTargetDateStr,
                     reason: `Imported screening ${risk} risk follow-up`,
                     risk_level: risk,
                     status: "pending",
                     created_by: userId,
                   });
                   followUpsScheduled += 1;
                }
              }
            }
          } catch (fuErr) {
            console.error("Failed to schedule follow-up for member:", memberUuid, fuErr);
          }
        }
      }
    }

    return { success: true, housesAdded, housesUpdated, membersAdded, membersMerged, followUpsScheduled };
  });

export const deleteImportBatch = createServerFn({ method: "POST" })
  .validator(z.object({ batchId: z.string() }))
  .handler(async ({ data: { batchId } }) => {
    const adminClient = getSupabaseAdmin();
    
    // Get batch info
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
        .contains("source_files", [filename]);
        
      if (mError) throw mError;
      
      for (const member of (members || [])) {
        if (member.source_files.length === 1) {
          // Delete assessments/followups first to prevent FK constraint errors if cascade isn't on
          await adminClient.from(tables.memberAssessments).delete().eq("member_uuid", member.id);
          await adminClient.from(tables.followUps).delete().eq("member_uuid", member.id);
          
          await adminClient.from(tables.houseMembers).delete().eq("id", member.id);
          membersDeleted++;
        } else {
          // Update array
          const newSources = member.source_files.filter((f: string) => f !== filename);
          await adminClient.from(tables.houseMembers).update({ source_files: newSources }).eq("id", member.id);
        }
      }

      // 2. Houses
      const { data: houses, error: hError } = await adminClient
        .from(tables.houses)
        .select("id, source_files")
        .contains("source_files", [filename]);
        
      if (hError) throw hError;

      for (const house of (houses || [])) {
        if (house.source_files.length === 1) {
          await adminClient.from(tables.houses).delete().eq("id", house.id);
          housesDeleted++;
        } else {
          const newSources = house.source_files.filter((f: string) => f !== filename);
          await adminClient.from(tables.houses).update({ source_files: newSources }).eq("id", house.id);
        }
      }
    }

    // Delete conflicts
    await adminClient.from(tables.importConflicts).delete().eq("batch_id", batchId);
    
    // Mark batch as deleted
    await adminClient.from(tables.importBatches).update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", batchId);

    return { success: true, housesDeleted, membersDeleted };
  });

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
      const { data: profile } = await adminClient.from(tables.profiles).select("full_name, username").eq("id", newAssigneeId).single();
      assignedToName = profile?.full_name || profile?.username || null;
      
      const { data: membership } = await adminClient.from(tables.teamMemberships).select("supervisor_id").eq("csw_id", newAssigneeId).eq("status", "active").maybeSingle();
      if (membership) {
        supervisorId = membership.supervisor_id;
      }
    }
    
    await adminClient.from(tables.importBatches).update({
      assigned_to: newAssigneeId,
      assigned_to_name: assignedToName,
      supervisor_id: supervisorId,
      updated_at: new Date().toISOString()
    }).eq("id", batchId);
    
    for (const file of files) {
      await adminClient.from(tables.houses)
        .update({ assigned_csw_id: newAssigneeId, supervisor_id: supervisorId })
        .contains("source_files", [file]);
    }
    
    return { success: true };
  });
