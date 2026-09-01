import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import { followUpConfig } from "@/config/followups";
import { calculateRisk, toStringArray, numberOrNull } from "@/lib/domain";
import type { RiskLevel } from "@/config/risk";
import {
  isEligibleForFollowUp,
  parseLegacyFollowUps,
  calculateNextFollowUpDate,
} from "@/lib/followUpEngine";

export interface ImportJobState {
  id: string; // batch ID
  fileNames: string[];
  uploadedBy: string;
  uploadedByName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  supervisorId: string | null;
  status: "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | "cancelled";
  currentStage: string;
  totalRows: number;
  processedRows: number;
  housesAdded: number;
  housesUpdated: number;
  membersAdded: number;
  membersMerged: number;
  failedRows: number;
  conflictsCount: number;
  progressPercent: number;
  errorSummary: Array<{ row: number; item: string; error: string }>;
  startedAt: string;
  completedAt: string | null;
  lastHeartbeatAt: string;
}

export interface PreviewMemberPayload {
  key: string;
  name: string;
  memberId: string | null;
  fields: Record<string, unknown>;
  extra: Record<string, unknown>;
  existingId: string | null;
  matchConfidence: number;
  action: "insert" | "merge" | "review";
  sourceFiles: string[];
}

export interface PreviewHousePayload {
  key: string;
  houseId: string | null;
  fields: Record<string, unknown>;
  extra: Record<string, unknown>;
  existingId: string | null;
  action: "insert" | "merge";
  sourceFiles: string[];
  hasLocation: boolean;
  hasInvalidCoordinates: boolean;
  members: PreviewMemberPayload[];
}

export interface PreviewConflictPayload {
  entity: "house" | "member";
  houseKey: string;
  memberKey?: string | undefined;
  label: string;
  field: string;
  existingValue: string;
  newValue: string;
  sourceFile: string;
}

export interface JobPayload {
  houses: PreviewHousePayload[];
  conflicts: PreviewConflictPayload[];
  decisions?: Record<string, "insert" | "merge"> | undefined;
  newFields?: string[] | undefined;
}

/**
 * Server-Side In-Memory + DB Sync Import Job Manager.
 * Retains job state in memory and persists progress and results to Supabase.
 */
class ImportJobManager {
  private jobs: Map<string, ImportJobState> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  public registerJob(
    batchId: string,
    meta: {
      fileNames: string[];
      uploadedBy: string;
      uploadedByName: string | null;
      assignedTo: string | null;
      assignedToName: string | null;
      supervisorId: string | null;
      totalRows: number;
      uniqueHouses: number;
    },
  ): ImportJobState {
    const state: ImportJobState = {
      id: batchId,
      fileNames: meta.fileNames,
      uploadedBy: meta.uploadedBy,
      uploadedByName: meta.uploadedByName,
      assignedTo: meta.assignedTo,
      assignedToName: meta.assignedToName,
      supervisorId: meta.supervisorId,
      status: "queued",
      currentStage: "Queued",
      totalRows: meta.totalRows,
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
    };

    this.jobs.set(batchId, state);
    this.abortControllers.set(batchId, new AbortController());
    return state;
  }

  public getJob(batchId: string): ImportJobState | null {
    return this.jobs.get(batchId) ?? null;
  }

  public getActiveJob(): ImportJobState | null {
    for (const job of this.jobs.values()) {
      if (job.status === "processing" || job.status === "queued") {
        return job;
      }
    }
    // Return latest job if available
    const all = Array.from(this.jobs.values());
    if (all.length > 0) {
      return all[all.length - 1]!;
    }
    return null;
  }

  public cancelJob(batchId: string): boolean {
    const ac = this.abortControllers.get(batchId);
    if (ac) {
      ac.abort();
    }
    const job = this.jobs.get(batchId);
    if (job && (job.status === "processing" || job.status === "queued")) {
      job.status = "cancelled";
      job.currentStage = "Cancelled by user";
      job.completedAt = new Date().toISOString();
      job.lastHeartbeatAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Starts background processing in a detached async execution context on the server.
   */
  public startBackgroundProcessing(batchId: string, payload: JobPayload) {
    // Run asynchronously without awaiting in HTTP response
    setTimeout(() => {
      this.executeJob(batchId, payload).catch((err) => {
        console.error(`[ImportJobManager] Critical unhandled error in job ${batchId}:`, err);
        const job = this.jobs.get(batchId);
        if (job) {
          job.status = "failed";
          job.currentStage = "Failed";
          job.completedAt = new Date().toISOString();
          job.errorSummary.push({
            row: 0,
            item: "System Error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    }, 10);
  }

  private async executeJob(batchId: string, payload: JobPayload) {
    const job = this.jobs.get(batchId);
    const ac = this.abortControllers.get(batchId);
    if (!job) return;

    job.status = "processing";
    job.currentStage = "Initializing database connection";
    job.lastHeartbeatAt = new Date().toISOString();

    const adminClient = getSupabaseAdmin();
    const { houses, conflicts, decisions } = payload;

    // 1. Resolve supervisor if needed
    let actualSupervisorId = job.supervisorId;
    if (job.assignedTo && !actualSupervisorId) {
      try {
        const { data: membership } = await adminClient
          .from(tables.teamMemberships)
          .select("supervisor_id")
          .eq("csw_id", job.assignedTo)
          .eq("status", "active")
          .maybeSingle();
        if (membership) {
          actualSupervisorId = membership.supervisor_id;
        }
      } catch (err) {
        console.warn("Supervisor lookup error:", err);
      }
      let validUploadedBy: string | null = job.supervisorId || job.assignedTo || null;
      if (validUploadedBy === "admin" || validUploadedBy === "supervisor") {
        validUploadedBy = null;
      }

      job.currentStage = "Checking existing records & indexing";
      job.lastHeartbeatAt = new Date().toISOString();

      // 2. Pre-fetch existing houses and members in bulk for fast duplicate detection
      const [{ data: existingHousesData }, { data: existingMembersData }] = await Promise.all([
        adminClient.from(tables.houses).select("id, house_id, house_number, address, owner_name"),
        adminClient
          .from(tables.houseMembers)
          .select("id, house_uuid, member_id, member_name, data"),
      ]);

      const existingHouses = existingHousesData || [];
      const existingMembers = existingMembersData || [];

      // Map existing houses by lowercase identifiers
      const houseMap = new Map<string, string>(); // key -> house.id
      for (const h of existingHouses) {
        if (h.house_id) houseMap.set(`id:${h.house_id.trim().toLowerCase()}`, h.id);
        if (h.house_number) houseMap.set(`num:${h.house_number.trim().toLowerCase()}`, h.id);
        const addr = `addr:${(h.address || "").trim().toLowerCase()}|${(h.owner_name || "").trim().toLowerCase()}`;
        if (h.address || h.owner_name) houseMap.set(addr, h.id);
      }

      // Map existing members by (house_uuid + member_id) and (house_uuid + member_name_lower)
      const memberMap = new Map<string, { id: string; data: Record<string, any> }>();
      for (const m of existingMembers) {
        const data = (m.data || {}) as Record<string, any>;
        if (m.house_uuid && m.member_id) {
          memberMap.set(`${m.house_uuid}:${m.member_id.trim().toLowerCase()}`, { id: m.id, data });
        }
        if (m.house_uuid && m.member_name) {
          memberMap.set(`${m.house_uuid}:name:${m.member_name.trim().toLowerCase()}`, {
            id: m.id,
            data,
          });
        }
      }

      // 3. Process Houses in High-Performance Batches (Chunk of 50 houses)
      const CHUNK_SIZE = 50;
      const totalHouses = houses.length;

      job.currentStage = "Importing members & assessments";

      for (let i = 0; i < totalHouses; i += CHUNK_SIZE) {
        if (ac?.signal.aborted) {
          job.status = "cancelled";
          job.currentStage = "Cancelled by user";
          job.completedAt = new Date().toISOString();
          await adminClient
            .from(tables.importBatches)
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", batchId);
          return;
        }

        const chunk = houses.slice(i, i + CHUNK_SIZE);

        for (const house of chunk) {
          try {
            const latRaw = house.fields["latitude"];
            const lngRaw = house.fields["longitude"];
            const lat = numberOrNull(latRaw);
            const lng = numberOrNull(lngRaw);

            const validLat = lat != null && lat >= -90 && lat <= 90 ? lat : null;
            const validLng = lng != null && lng >= -180 && lng <= 180 ? lng : null;
            const locationStatus = validLat != null && validLng != null ? "mapped" : "not_mapped";

            const validUploadedBy =
              job.uploadedBy &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.uploadedBy)
                ? job.uploadedBy
                : null;

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
              uploaded_by: validUploadedBy,
              uploaded_at: new Date().toISOString(),
              assigned_csw_id: job.assignedTo ?? null,
              supervisor_id: actualSupervisorId,
            };

            // Find or create house
            let houseUuid: string | null = house.existingId;
            if (!houseUuid && house.fields["house_id"]) {
              houseUuid =
                houseMap.get(`id:${String(house.fields["house_id"]).trim().toLowerCase()}`) ?? null;
            }
            if (!houseUuid && house.fields["house_number"]) {
              houseUuid =
                houseMap.get(`num:${String(house.fields["house_number"]).trim().toLowerCase()}`) ??
                null;
            }

            if (houseUuid) {
              const clean = Object.fromEntries(
                Object.entries(housePayload).filter(([, v]) => v != null),
              );
              await adminClient.from(tables.houses).update(clean).eq("id", houseUuid);
              job.housesUpdated += 1;
            } else {
              const { data, error } = await adminClient
                .from(tables.houses)
                .insert({ ...housePayload, created_by: validUploadedBy })
                .select("id")
                .single();
              if (error) throw error;
              houseUuid = data.id;
              job.housesAdded += 1;

              if (housePayload.house_id && houseUuid) {
                houseMap.set(`id:${housePayload.house_id.trim().toLowerCase()}`, houseUuid);
              }
            }

            if (!houseUuid) continue;

            // 4. Process Members in this House
            for (const member of house.members) {
              try {
                const decision = decisions?.[member.key];
                const action = member.action === "review" ? (decision ?? "insert") : member.action;
                const newFieldsAndExtra = { ...member.fields, ...member.extra } as Record<
                  string,
                  any
                >;

                // Multi-member house check
                let existingMember = member.existingId
                  ? memberMap.get(`${houseUuid}:${member.memberId?.trim().toLowerCase()}`) ||
                    memberMap.get(`${houseUuid}:name:${member.name.trim().toLowerCase()}`) ||
                    null
                  : null;

                if (!existingMember && member.memberId && houseUuid) {
                  existingMember =
                    memberMap.get(`${houseUuid}:${member.memberId.trim().toLowerCase()}`) ?? null;
                }
                if (!existingMember && member.name && houseUuid) {
                  existingMember =
                    memberMap.get(`${houseUuid}:name:${member.name.trim().toLowerCase()}`) ?? null;
                }

                // Database-level verification for unique (house_uuid, member_id)
                if (!existingMember && member.memberId && houseUuid) {
                  const { data: dbMem } = await adminClient
                    .from(tables.houseMembers)
                    .select("id, data")
                    .eq("house_uuid", houseUuid)
                    .eq("member_id", member.memberId)
                    .maybeSingle();
                  if (dbMem) {
                    existingMember = {
                      id: dbMem.id,
                      data: (dbMem.data as Record<string, any>) || {},
                    };
                  }
                }

                let memberUuid: string | null = null;

                if (
                  (action === "merge" || existingMember) &&
                  (existingMember?.id || member.existingId)
                ) {
                  const targetId = existingMember?.id || member.existingId!;
                  const existingData = existingMember?.data || {};

                  // Merge non-destructively: preserve existing valid values over empty new values
                  const merged = { ...existingData };
                  for (const [k, v] of Object.entries(newFieldsAndExtra)) {
                    if (v != null && v !== "") {
                      // Special case: combine follow-up history strings instead of overwriting
                      if (
                        k === "follow_ups" &&
                        existingData["follow_ups"] &&
                        existingData["follow_ups"] !== v
                      ) {
                        const combined = `${existingData["follow_ups"]}\n${v}`;
                        merged[k] = combined;
                      } else {
                        merged[k] = v;
                      }
                    }
                  }

                  await adminClient
                    .from(tables.houseMembers)
                    .update({
                      member_name: member.name,
                      data: merged,
                      source_files: member.sourceFiles,
                      possible_duplicate: member.matchConfidence < 0.95,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", targetId);

                  memberUuid = targetId;
                  job.membersMerged += 1;

                  if (houseUuid && memberUuid && member.memberId) {
                    memberMap.set(`${houseUuid}:${member.memberId.trim().toLowerCase()}`, {
                      id: memberUuid,
                      data: merged,
                    });
                  }
                  if (houseUuid && memberUuid && member.name) {
                    memberMap.set(`${houseUuid}:name:${member.name.trim().toLowerCase()}`, {
                      id: memberUuid,
                      data: merged,
                    });
                  }
                } else {
                  // Insert brand new member
                  const { data: inserted, error: insErr } = await adminClient
                    .from(tables.houseMembers)
                    .insert({
                      house_uuid: houseUuid,
                      member_id: member.memberId,
                      member_name: member.name,
                      data: newFieldsAndExtra,
                      source_files: member.sourceFiles,
                      uploaded_by: validUploadedBy,
                      uploaded_at: new Date().toISOString(),
                      possible_duplicate: member.action === "review",
                    })
                    .select("id")
                    .single();

                  if (insErr) throw insErr;
                  memberUuid = inserted.id;
                  job.membersAdded += 1;

                  // Index in local map for subsequent rows in this same upload
                  if (houseUuid && memberUuid && member.memberId) {
                    memberMap.set(`${houseUuid}:${member.memberId.trim().toLowerCase()}`, {
                      id: memberUuid,
                      data: newFieldsAndExtra,
                    });
                  }
                  if (houseUuid && memberUuid && member.name) {
                    memberMap.set(`${houseUuid}:name:${member.name.trim().toLowerCase()}`, {
                      id: memberUuid,
                      data: newFieldsAndExtra,
                    });
                  }
                }

                // 5. Clinical Assessments & Follow-up History
                if (memberUuid && houseUuid) {
                  const screeningDateRaw =
                    member.fields["screening_date"] ||
                    member.fields["survey_date"] ||
                    newFieldsAndExtra["screening_date"] ||
                    newFieldsAndExtra["survey_date"];

                  const surveyDateObj = screeningDateRaw
                    ? new Date(String(screeningDateRaw))
                    : new Date();
                  const validSurveyDate = isNaN(surveyDateObj.getTime())
                    ? new Date()
                    : surveyDateObj;

                  const systolic = numberOrNull(
                    member.fields["systolic"] ?? newFieldsAndExtra["systolic"],
                  );
                  const diastolic = numberOrNull(
                    member.fields["diastolic"] ?? newFieldsAndExtra["diastolic"],
                  );
                  const bloodSugar = numberOrNull(
                    member.fields["blood_sugar"] ?? newFieldsAndExtra["blood_sugar"],
                  );
                  const conditions = toStringArray(
                    member.fields["known_history"] ?? newFieldsAndExtra["known_history"] ?? [],
                  );

                  const hasClinicalData =
                    systolic != null ||
                    diastolic != null ||
                    bloodSugar != null ||
                    conditions.length > 0;

                  if (hasClinicalData) {
                    // Use DB-configured thresholds when available (server authoritative)
                    let thresholds;
                    try {
                      const { getHealthThresholdSettings } =
                        await import("@/services/settingsService");
                      const s = await getHealthThresholdSettings();
                      thresholds = {
                        bp: {
                          high: { systolic: s.systolic_high_min, diastolic: s.diastolic_high_min },
                          moderate: {
                            systolic: s.systolic_moderate_min,
                            diastolic: s.diastolic_moderate_min,
                          },
                        },
                        sugar: { high: s.sugar_high_min, moderate: s.sugar_moderate_min },
                      };
                    } catch (e) {
                      thresholds = undefined;
                    }

                    const riskResult = calculateRisk(
                      { systolic, diastolic, bloodSugar, conditions },
                      thresholds,
                    );
                    const risk: RiskLevel = riskResult.level;

                    // Insert assessment record
                    await adminClient.from(tables.memberAssessments).insert({
                      house_uuid: houseUuid,
                      member_uuid: memberUuid,
                      systolic,
                      diastolic,
                      blood_sugar: bloodSugar,
                      known_history: conditions,
                      risk_level: risk,
                      risk_reasons: riskResult.reasons,
                      assessed_by: validUploadedBy,
                      assessed_at: validSurveyDate.toISOString(),
                      available: true,
                      referral_needed: false,
                    });

                    // Check follow-up eligibility (strictly age >= 30)
                    const age = numberOrNull(newFieldsAndExtra["age"] ?? member.fields["age"]);
                    // Check DB-configured minimum eligible age if present
                    let minEligibleAge: number | undefined;
                    let customIntervals: Record<RiskLevel, number> | undefined;
                    try {
                      const { getHealthThresholdSettings } =
                        await import("@/services/settingsService");
                      const s = await getHealthThresholdSettings();
                      minEligibleAge = s.minimum_eligible_age;
                      customIntervals = {
                        high: s.interval_high,
                        moderate: s.interval_moderate,
                        normal: s.interval_normal,
                      };
                    } catch (e) {
                      /* ignore - fall back */
                    }
                    const isEligible =
                      typeof minEligibleAge === "number"
                        ? age != null && age >= minEligibleAge
                        : isEligibleForFollowUp(age, 30);

                    if (isEligible) {
                      // Check legacy history in fields
                      const followUpHistoryRaw =
                        newFieldsAndExtra["follow_ups"] ||
                        newFieldsAndExtra["followup"] ||
                        member.fields["follow_ups"] ||
                        "";

                      const parsedHistory = parseLegacyFollowUps(followUpHistoryRaw);
                      const latestHistoryItem = parsedHistory
                        .slice()
                        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];

                      let anchorDate = validSurveyDate;
                      if (latestHistoryItem) {
                        const histParsed = new Date(latestHistoryItem.dateKey + "T00:00:00");
                        if (!isNaN(histParsed.getTime())) {
                          anchorDate = histParsed;
                        }
                      }

                      const nextDueDateStr = calculateNextFollowUpDate(
                        anchorDate,
                        risk,
                        customIntervals ?? followUpConfig.intervalDays,
                      );

                      // Check for existing pending follow-up
                      const { data: existingPending } = await adminClient
                        .from(tables.followUps)
                        .select("id")
                        .eq("member_uuid", memberUuid)
                        .eq("status", "pending")
                        .maybeSingle();

                      if (existingPending) {
                        // Update existing pending without creating duplicate
                        await adminClient
                          .from(tables.followUps)
                          .update({
                            due_date: nextDueDateStr,
                            risk_level: risk,
                            reason: `Imported screening ${risk} risk follow-up`,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", existingPending.id);

                        await adminClient
                          .from(tables.tasks)
                          .update({
                            due_date: nextDueDateStr,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("follow_up_id", existingPending.id);
                      } else {
                        // Insert new pending follow-up and synchronized task
                        const { data: insertedFup } = await adminClient
                          .from(tables.followUps)
                          .insert({
                            house_uuid: houseUuid,
                            member_uuid: memberUuid,
                            due_date: nextDueDateStr,
                            reason: `Imported screening ${risk} risk follow-up`,
                            risk_level: risk,
                            status: "pending",
                            created_by: validUploadedBy,
                          })
                          .select("id")
                          .single();

                        if (insertedFup) {
                          await adminClient.from(tables.tasks).insert({
                            house_uuid: houseUuid,
                            member_uuid: memberUuid,
                            follow_up_id: insertedFup.id,
                            task_type: "follow_up",
                            status: "pending",
                            due_date: nextDueDateStr,
                            created_by: validUploadedBy,
                          });
                        }
                      }
                    }
                  }
                }

                job.processedRows += 1;
              } catch (memberErr: any) {
                job.failedRows += 1;
                job.processedRows += 1;
                job.errorSummary.push({
                  row: job.processedRows,
                  item: member.name || "Member",
                  error:
                    memberErr?.message ||
                    (typeof memberErr === "object" ? JSON.stringify(memberErr) : String(memberErr)),
                });
              }
            }
          } catch (houseErr: any) {
            job.failedRows += house.members.length || 1;
            job.processedRows += house.members.length || 1;
            job.errorSummary.push({
              row: job.processedRows,
              item: house.houseId || "House",
              error:
                houseErr?.message ||
                (typeof houseErr === "object" ? JSON.stringify(houseErr) : String(houseErr)),
            });
          }
        }

        // Update real progress
        job.progressPercent = Math.min(
          99,
          Math.round((job.processedRows / Math.max(1, job.totalRows)) * 100),
        );
        job.lastHeartbeatAt = new Date().toISOString();
        job.currentStage = `Importing records (${job.processedRows} / ${job.totalRows})`;
      }

      // 6. Record conflicts if any
      if (conflicts && conflicts.length > 0) {
        job.currentStage = "Recording conflicts";
        const conflictRows = conflicts.map((c) => ({
          batch_id: batchId,
          entity: c.entity,
          house_id: c.label || c.houseKey,
          member_ref: c.memberKey ?? null,
          field: c.field,
          existing_value: c.existingValue,
          new_value: c.newValue,
          source_file: c.sourceFile,
          status: "pending",
        }));

        for (let cIdx = 0; cIdx < conflictRows.length; cIdx += 100) {
          await adminClient
            .from(tables.importConflicts)
            .insert(conflictRows.slice(cIdx, cIdx + 100));
        }
        job.conflictsCount = conflicts.length;
      }

      // 7. Finalize Job
      job.currentStage = "Finalizing";
      const finalStatus = job.failedRows > 0 ? "completed_with_errors" : "completed";
      job.status = finalStatus;
      job.progressPercent = 100;
      job.completedAt = new Date().toISOString();
      job.lastHeartbeatAt = new Date().toISOString();
      job.currentStage =
        finalStatus === "completed" ? "Completed successfully" : "Completed with errors";

      // Update Supabase import_batches record
      await adminClient
        .from(tables.importBatches)
        .update({
          houses_added: job.housesAdded,
          houses_updated: job.housesUpdated,
          members_added: job.membersAdded,
          members_merged: job.membersMerged,
          merged_records: job.membersMerged,
          conflicts: job.conflictsCount,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchId);
    }
  }
}

// Global Singleton Instance
const globalForImport = globalThis as unknown as { importJobManagerInstance?: ImportJobManager };
export const importJobManager = globalForImport.importJobManagerInstance ?? new ImportJobManager();
globalForImport.importJobManagerInstance = importJobManager;
