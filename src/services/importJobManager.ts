import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import { followUpConfig } from "@/config/followups";
import { toStringArray, numberOrNull } from "@/lib/domain";
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
    }

    let validUploadedBy: string | null = job.supervisorId || job.assignedTo || null;
    if (validUploadedBy === "admin" || validUploadedBy === "supervisor") {
      validUploadedBy = null;
    }

    job.currentStage = "Checking existing records & indexing";
    job.lastHeartbeatAt = new Date().toISOString();

    // 2. Local Maps for duplicate detection (populated dynamically per-chunk)
    const houseMap = new Map<string, string>(); // key -> house.id
    const memberMap = new Map<string, { id: string; data: Record<string, any> }>();

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

      // Pre-fetch houses for this chunk to avoid duplicates
      const chunkHouseIds = chunk
        .map((h) => (h.fields["house_id"] ? String(h.fields["house_id"]).trim() : ""))
        .filter(Boolean);
      const chunkHouseNums = chunk
        .map((h) => (h.fields["house_number"] ? String(h.fields["house_number"]).trim() : ""))
        .filter(Boolean);

      if (chunkHouseIds.length > 0) {
        const { data } = await adminClient
          .from(tables.houses)
          .select("id, house_id")
          .in("house_id", chunkHouseIds);
        if (data) {
          data.forEach((h) => houseMap.set(`id:${h.house_id.trim().toLowerCase()}`, h.id));
        }
      }
      if (chunkHouseNums.length > 0) {
        const { data } = await adminClient
          .from(tables.houses)
          .select("id, house_number")
          .in("house_number", chunkHouseNums);
        if (data) {
          data.forEach((h) => houseMap.set(`num:${h.house_number.trim().toLowerCase()}`, h.id));
        }
      }

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

              // -- CANONICAL NORMALIZATION --
              // 1. Clinical Risk
              const rawRisk = newFieldsAndExtra["clinical_risk"];
              let normalizedRisk = "missing";
              if (rawRisk != null && String(rawRisk).trim() !== "") {
                const str = String(rawRisk).trim().toLowerCase();
                if (str === "high" || str === "moderate" || str === "low") {
                  normalizedRisk = str;
                } else if (str === "normal") {
                  normalizedRisk = "low";
                } else {
                  normalizedRisk = "invalid";
                }
              }
              newFieldsAndExtra["clinical_risk"] = normalizedRisk;

              // 2. Eligible
              const rawEligible = newFieldsAndExtra["eligible"];
              if (rawEligible != null && String(rawEligible).trim().toLowerCase() === "yes") {
                newFieldsAndExtra["eligible"] = "Yes";
              } else if (rawEligible != null && String(rawEligible).trim().toLowerCase() === "no") {
                newFieldsAndExtra["eligible"] = "No";
              }

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
              let finalMemberData: Record<string, any> = newFieldsAndExtra;

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

                finalMemberData = merged;

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
              // CANONICAL DATA CONTRACT: clinical_risk and eligible come from Excel,
              // not from recalculating vitals. Survey Date / Screening Date is the anchor.
              if (memberUuid && houseUuid) {
                // -- A. Determine anchor date (Screening Date preferred, then Survey Date) --
                const screeningDateRaw =
                  member.fields["screening_date"] ||
                  newFieldsAndExtra["screening_date"] ||
                  member.fields["survey_date"] ||
                  newFieldsAndExtra["survey_date"];

                const { parseDateSafe: parseDateSafeImport } = await import("@/lib/followUpEngine");

                const surveyDateParsed = parseDateSafeImport(
                  screeningDateRaw ? String(screeningDateRaw) : null,
                );
                const validSurveyDate = surveyDateParsed ?? new Date();

                // -- B. Vitals from Excel --
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

                // -- C. Clinical Risk -- READ FROM EXCEL ONLY (authoritative) --
                const excelClinicalRisk = newFieldsAndExtra["clinical_risk"]; // already normalized above
                let risk: RiskLevel | null = null;
                let riskReasons: string[] = [];

                if (
                  excelClinicalRisk === "high" ||
                  excelClinicalRisk === "moderate" ||
                  excelClinicalRisk === "low"
                ) {
                  risk = excelClinicalRisk as RiskLevel;
                  riskReasons = [`Clinical Risk from Excel: ${excelClinicalRisk}`];
                } else if (excelClinicalRisk === "invalid") {
                  riskReasons = [`Invalid Clinical Risk value in Excel — stored as null`];
                  job.errorSummary.push({
                    row: job.processedRows + 1,
                    item: member.name || "Member",
                    error: `Invalid Clinical Risk in Excel. Stored as null.`,
                  });
                } else {
                  riskReasons = ["Clinical Risk not provided in Excel — stored as null"];
                  const hasSomeData = systolic != null || diastolic != null || bloodSugar != null;
                  if (hasSomeData) {
                    job.errorSummary.push({
                      row: job.processedRows + 1,
                      item: member.name || "Member",
                      error: `Clinical Risk missing in Excel (vitals present). Stored as null — please update source data.`,
                    });
                  }
                }

                // -- D. Persist assessment if there is any clinical data --
                const hasClinicalData =
                  systolic != null ||
                  diastolic != null ||
                  bloodSugar != null ||
                  conditions.length > 0 ||
                  (excelClinicalRisk !== "missing" && excelClinicalRisk !== "invalid");

                if (hasClinicalData) {
                  await adminClient.from(tables.memberAssessments).insert({
                    house_uuid: houseUuid,
                    member_uuid: memberUuid,
                    systolic,
                    diastolic,
                    blood_sugar: bloodSugar,
                    known_history: conditions,
                    risk_level: risk,
                    risk_reasons: riskReasons,
                    assessed_by: validUploadedBy,
                    assessed_at: validSurveyDate.toISOString(),
                    available: true,
                    referral_needed: false,
                  });
                }

                // -- E. Eligibility -- Read from Excel --
                const eligibleRaw = newFieldsAndExtra["eligible"];
                const isEligible = eligibleRaw === "Yes";

                // -- F. Create follow-up only for eligible members WITH a valid Clinical Risk --
                // If Clinical Risk is missing/null, we cannot determine the correct interval,
                // so no follow-up is created. This prevents false scheduling.
                if (isEligible && hasClinicalData && risk !== null) {
                  // Get configured intervals (low=180, moderate=30, high=15)
                  const { getHealthThresholdSettings } = await import("@/services/settingsService");
                  const s = await getHealthThresholdSettings();
                  const customIntervals: Record<RiskLevel, number> = {
                    high: s.interval_high ?? 15,
                    moderate: s.interval_moderate ?? 30,
                    low: s.interval_low ?? 180,
                  };

                  // -- G. Follow-up Anchor Date --
                  // RULE: Use SURVEY / SCREENING DATE from Excel as the initial anchor.
                  // If Excel contains completed follow-up history, use the most recent
                  // completed date as the recurrence anchor.
                  const followUpHistoryRaw = finalMemberData["follow_ups"] || "";

                  const parsedHistory = parseLegacyFollowUps(followUpHistoryRaw);
                  const completedHistory = parsedHistory.filter((h) => h.status === "completed");

                  // -- Fetch existing completed history to prevent duplicates on re-import --
                  const { data: existingCompletedRaw } = await adminClient
                    .from(tables.followUps)
                    .select("id, due_date")
                    .eq("member_uuid", memberUuid)
                    .eq("status", "completed");
                  const existingCompletedDates = new Set(
                    (existingCompletedRaw || []).map((f) => f.due_date),
                  );

                  // -- Insert missing historical completed records --
                  for (const hist of completedHistory) {
                    if (!existingCompletedDates.has(hist.dateKey)) {
                      await adminClient.from(tables.followUps).insert({
                        house_uuid: houseUuid,
                        member_uuid: memberUuid,
                        due_date: hist.dateKey,
                        status: "completed",
                        reason: hist.reason || "Imported historical completed follow-up",
                        notes: hist.notes || null,
                        risk_level: risk, // We apply the current Excel canonical risk retrospectively
                        created_by: validUploadedBy,
                        completed_at:
                          parseDateSafeImport(hist.dateKey)?.toISOString() ||
                          new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      });
                      existingCompletedDates.add(hist.dateKey);
                    }
                  }

                  const latestCompletedItem = completedHistory
                    .slice()
                    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];

                  // Anchor = survey date (NOT import date)
                  // Override with latest completed follow-up date if history exists
                  let anchorDate = validSurveyDate;
                  if (latestCompletedItem) {
                    const histParsed = parseDateSafeImport(latestCompletedItem.dateKey);
                    if (histParsed) {
                      anchorDate = histParsed;
                    }
                  }

                  const nextDueDateStr = calculateNextFollowUpDate(
                    anchorDate,
                    risk,
                    customIntervals,
                  );

                  // -- H. Duplicate protection -- one pending follow-up per member --
                  const { data: existingPending } = await adminClient
                    .from(tables.followUps)
                    .select("id")
                    .eq("member_uuid", memberUuid)
                    .eq("status", "pending")
                    .maybeSingle();

                  if (existingPending) {
                    // Update existing pending follow-up (idempotent import)
                    await adminClient
                      .from(tables.followUps)
                      .update({
                        due_date: nextDueDateStr,
                        risk_level: risk,
                        reason: `Imported ${risk} risk follow-up`,
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
                    // Create new pending follow-up
                    const { data: insertedFup } = await adminClient
                      .from(tables.followUps)
                      .insert({
                        house_uuid: houseUuid,
                        member_uuid: memberUuid,
                        due_date: nextDueDateStr,
                        reason: `Imported ${risk} risk follow-up`,
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
                // If isEligible=false or risk=null: no follow-up is created (per spec)
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
        await adminClient.from(tables.importConflicts).insert(conflictRows.slice(cIdx, cIdx + 100));
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

// Global Singleton Instance
const globalForImport = globalThis as unknown as { importJobManagerInstance?: ImportJobManager };
export const importJobManager = globalForImport.importJobManagerInstance ?? new ImportJobManager();
globalForImport.importJobManagerInstance = importJobManager;
