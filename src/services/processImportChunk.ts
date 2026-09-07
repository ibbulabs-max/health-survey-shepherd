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
import { normalizePinType } from "@/lib/pin-types";

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

export async function processImportChunk(
  batchId: string,
  houses: PreviewHousePayload[],
  decisions?: Record<string, "insert" | "merge">,
  uploadedBy?: string | null,
  assignedTo?: string | null,
  supervisorId?: string | null,
) {
  const adminClient = getSupabaseAdmin();
  const result = {
    housesAdded: 0,
    housesUpdated: 0,
    membersAdded: 0,
    membersMerged: 0,
    errorSummary: [] as Array<{ row: number; item: string; error: string }>,
  };

  // 1. Resolve supervisor if needed
  let actualSupervisorId = supervisorId;
  if (assignedTo && !actualSupervisorId) {
    try {
      const { data: membership } = await adminClient
        .from(tables.teamMemberships)
        .select("supervisor_id")
        .eq("csw_id", assignedTo)
        .eq("status", "active")
        .maybeSingle();
      if (membership) {
        actualSupervisorId = membership.supervisor_id;
      }
    } catch (err) {
      console.warn("Supervisor lookup error:", err);
    }
  }

  let validUploadedBy: string | null = supervisorId || assignedTo || null;
  if (validUploadedBy === "admin" || validUploadedBy === "supervisor") {
    validUploadedBy = null;
  }

  // 2. Local Maps for duplicate detection (populated dynamically per-chunk)
  const houseMap = new Map<string, string>(); // key -> house.id
  const memberMap = new Map<string, { id: string; data: Record<string, any> }>();

  // 3. Process Houses in High-Performance Batches (Chunk of 50 houses)
  const CHUNK_SIZE = 50;
  const totalHouses = houses.length;

  for (let i = 0; i < totalHouses; i += CHUNK_SIZE) {
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
          uploadedBy &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadedBy)
            ? uploadedBy
            : null;

        const rawPinType =
          house.extra?.["Type"] ??
          house.extra?.["type"] ??
          house.extra?.["Pin Type"] ??
          house.extra?.["pin_type"] ??
          house.fields?.["Type"] ??
          house.fields?.["type"] ??
          (house.fields?.["house_id"] || house.fields?.["house_number"] ? "house" : undefined);
        const { pin_type: finalPinType, custom_type: finalCustomType } =
          normalizePinType(rawPinType);

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
          pin_type: finalPinType,
          custom_type: finalCustomType,
          data: house.extra as Record<string, any>,
          source_files: house.sourceFiles,
          uploaded_by: validUploadedBy,
          uploaded_at: new Date().toISOString(),
          assigned_csw_id: assignedTo ?? null,
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
          const { error: updErr } = await adminClient
            .from(tables.houses)
            .update(clean)
            .eq("id", houseUuid);
          if (updErr) throw updErr;
          result.housesUpdated += 1;
        } else {
          const { data, error } = await adminClient
            .from(tables.houses)
            .insert({ ...housePayload, created_by: validUploadedBy })
            .select("id")
            .single();
          if (error) throw error;
          houseUuid = data.id;
          result.housesAdded += 1;

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
            const newFieldsAndExtra = { ...member.fields, ...member.extra } as Record<string, any>;

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

              const { error: memUpdErr } = await adminClient
                .from(tables.houseMembers)
                .update({
                  member_name: member.name,
                  data: merged,
                  source_files: member.sourceFiles,
                  possible_duplicate: member.matchConfidence < 0.95,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", targetId);

              if (memUpdErr) throw memUpdErr;

              memberUuid = targetId;
              result.membersMerged += 1;

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
              result.membersAdded += 1;

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
                result.errorSummary.push({
                  row: 0 + 1,
                  item: member.name || "Member",
                  error: `Invalid Clinical Risk in Excel. Stored as null.`,
                });
              } else {
                riskReasons = ["Clinical Risk not provided in Excel — stored as null"];
                const hasSomeData = systolic != null || diastolic != null || bloodSugar != null;
                if (hasSomeData) {
                  result.errorSummary.push({
                    row: 0 + 1,
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
                const { error: assessErr } = await adminClient
                  .from(tables.memberAssessments)
                  .insert({
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
                if (assessErr) throw assessErr;
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
                    const { error: histErr } = await adminClient.from(tables.followUps).insert({
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
                    if (histErr) throw histErr;
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

                const nextDueDateStr = calculateNextFollowUpDate(anchorDate, risk, customIntervals);

                // -- H. Duplicate protection -- one pending follow-up per member --
                const { data: existingPending } = await adminClient
                  .from(tables.followUps)
                  .select("id")
                  .eq("member_uuid", memberUuid)
                  .eq("status", "pending")
                  .maybeSingle();

                if (existingPending) {
                  // Update existing pending follow-up (idempotent import)
                  const { error: fupUpdErr } = await adminClient
                    .from(tables.followUps)
                    .update({
                      due_date: nextDueDateStr,
                      risk_level: risk,
                      reason: `Imported ${risk} risk follow-up`,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingPending.id);
                  if (fupUpdErr) throw fupUpdErr;

                  const { error: taskUpdErr } = await adminClient
                    .from(tables.tasks)
                    .update({
                      due_date: nextDueDateStr,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("follow_up_id", existingPending.id);
                  if (taskUpdErr) throw taskUpdErr;
                } else {
                  // Create new pending follow-up
                  const { data: insertedFup, error: insFupErr } = await adminClient
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
                  if (insFupErr) throw insFupErr;

                  if (insertedFup) {
                    const { error: insTaskErr } = await adminClient.from(tables.tasks).insert({
                      house_uuid: houseUuid,
                      member_uuid: memberUuid,
                      follow_up_id: insertedFup.id,
                      task_type: "follow_up",
                      status: "pending",
                      due_date: nextDueDateStr,
                      created_by: validUploadedBy,
                    });
                    if (insTaskErr) throw insTaskErr;
                  }
                }
              }
              // If isEligible=false or risk=null: no follow-up is created (per spec)
            }
          } catch (memberErr: any) {
            result.errorSummary.push({
              row: 0,
              item: member.name || "Member",
              error:
                memberErr?.message ||
                (typeof memberErr === "object" ? JSON.stringify(memberErr) : String(memberErr)),
            });
          }
        }
      } catch (houseErr: any) {
        result.errorSummary.push({
          row: 0,
          item: house.houseId || "House",
          error:
            houseErr?.message ||
            (typeof houseErr === "object" ? JSON.stringify(houseErr) : String(houseErr)),
        });
      }
    }
  }

  return result;
}
