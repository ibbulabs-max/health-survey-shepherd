import { db } from "@/db/schema";
import { OfflineSyncService } from "@/services/offlineSync";
import { supabase } from "@/db/client";
import { v4 as uuidv4 } from "uuid";
import type { ImportPreview } from "@/services/importService";
import {
  parseLegacyFollowUps,
  parseDateSafe,
  calculateNextFollowUpDate,
} from "@/lib/followUpEngine";
import type { RiskLevel } from "@/config/risk";

export async function processImportLocal(
  preview: ImportPreview,
  decisions: Record<string, "insert" | "merge"> = {},
  options: {
    assignedTo?: string | null;
    uploadedBy?: string | null;
    supervisorId?: string | null;
  } = {},
) {
  // 1. Resolve and validate the real authenticated user UUID for created_by
  let authenticatedUserId = options.uploadedBy;
  if (!authenticatedUserId) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      authenticatedUserId = auth?.user?.id ?? null;
    } catch {
      // Offline fallback check
    }
  }

  if (!authenticatedUserId) {
    throw new Error(
      "Cannot import data: No valid authenticated user ID could be resolved for houses.created_by. Please log in before importing.",
    );
  }

  let housesAdded = 0;
  let housesUpdated = 0;
  let membersAdded = 0;
  let membersMerged = 0;
  const errors: any[] = [];

  // Separate queues to guarantee strict dependency order:
  // 1. houses -> 2. house_members -> 3. follow_ups
  const houseMutations: Array<{
    table: "houses";
    operation: "CREATE" | "UPDATE";
    payload: any;
  }> = [];

  const memberMutations: Array<{
    table: "house_members";
    operation: "CREATE" | "UPDATE";
    payload: any;
  }> = [];

  const followUpMutations: Array<{
    table: "follow_ups";
    operation: "CREATE" | "UPDATE";
    payload: any;
  }> = [];

  for (const h of preview.houses) {
    try {
      let houseId = h.existingId;

      if (h.action === "insert") {
        houseId = uuidv4();

        // Canonical defaults — NOT NULL in Supabase
        const rawPinType = h.fields["pin_type"] ? String(h.fields["pin_type"]).trim() : "";
        const pinType = rawPinType || "house";

        const rawHouseId = h.fields["house_id"] ? String(h.fields["house_id"]).trim() : "";
        const houseIdStr =
          rawHouseId ||
          (h.fields["house_number"]
            ? String(h.fields["house_number"]).trim()
            : `H-${houseId.slice(0, 8)}`);

        const housePayload = {
          id: houseId,
          house_id: houseIdStr,
          house_number: h.fields["house_number"] ? String(h.fields["house_number"]) : null,
          owner_name: h.fields["owner_name"] ? String(h.fields["owner_name"]) : null,
          address: h.fields["address"] ? String(h.fields["address"]) : null,
          latitude: h.fields["latitude"] ? Number(h.fields["latitude"]) : null,
          longitude: h.fields["longitude"] ? Number(h.fields["longitude"]) : null,
          pin_type: pinType, // Enforced non-null canonical value
          custom_type: h.fields["custom_type"] ? String(h.fields["custom_type"]) : null,
          location_status: h.hasLocation ? "mapped" : "not_mapped",
          location_source: h.hasLocation ? "import" : null,
          data: h.extra || {},
          source_files: h.sourceFiles,
          created_by: authenticatedUserId, // Valid non-null authenticated UUID
          uploaded_by: authenticatedUserId,
          uploaded_at: new Date().toISOString(),
          assigned_csw_id: options.assignedTo || null,
          supervisor_id: options.supervisorId || null,
          status: "active" as const,
        };

        await db.houses.add(housePayload as any);
        houseMutations.push({
          table: "houses",
          operation: "CREATE",
          payload: housePayload,
        });
        housesAdded++;
      } else if (h.action === "merge" && houseId) {
        if (Object.keys(h.fields).length > 0) {
          const updatePayload: any = {
            id: houseId,
            updated_at: new Date().toISOString(),
          };
          if (h.fields["house_id"]) updatePayload.house_id = String(h.fields["house_id"]);
          if (h.fields["house_number"])
            updatePayload.house_number = String(h.fields["house_number"]);
          if (h.fields["owner_name"]) updatePayload.owner_name = String(h.fields["owner_name"]);
          if (h.fields["address"]) updatePayload.address = String(h.fields["address"]);
          if (h.fields["latitude"]) updatePayload.latitude = Number(h.fields["latitude"]);
          if (h.fields["longitude"]) updatePayload.longitude = Number(h.fields["longitude"]);
          if (h.fields["pin_type"]) updatePayload.pin_type = String(h.fields["pin_type"]);
          if (h.fields["custom_type"]) updatePayload.custom_type = String(h.fields["custom_type"]);

          await db.houses.update(houseId, updatePayload);
          houseMutations.push({
            table: "houses",
            operation: "UPDATE",
            payload: updatePayload,
          });
          housesUpdated++;
        }
      }

      if (!houseId) continue;

      for (const m of h.members) {
        try {
          const action = m.action === "review" ? decisions[m.key] || "insert" : m.action;

          if (action === "insert") {
            const memberId = uuidv4();

            const newFieldsAndExtra = { ...m.fields, ...m.extra } as Record<string, any>;

            // Normalize Clinical Risk strictly per canonical rules (low / moderate / high)
            const rawRisk = newFieldsAndExtra["clinical_risk"];
            let normalizedRisk: "low" | "moderate" | "high" | null = null;
            if (rawRisk != null && String(rawRisk).trim() !== "") {
              const str = String(rawRisk).trim().toLowerCase();
              if (["high", "moderate", "low"].includes(str)) {
                normalizedRisk = str as "low" | "moderate" | "high";
                newFieldsAndExtra["clinical_risk"] = str;
              } else if (str === "normal") {
                normalizedRisk = "low";
                newFieldsAndExtra["clinical_risk"] = "low";
              } else {
                newFieldsAndExtra["clinical_risk"] = "invalid";
              }
            } else {
              newFieldsAndExtra["clinical_risk"] = "missing";
            }

            // Normalize Eligibility strictly per canonical rules (Yes / No)
            const rawEligible = newFieldsAndExtra["eligible"];
            let isEligible = false;
            if (rawEligible != null && String(rawEligible).trim() !== "") {
              const str = String(rawEligible).trim().toLowerCase();
              if (str === "yes" || str === "true" || str === "1") {
                isEligible = true;
                newFieldsAndExtra["eligible"] = "Yes";
              } else if (str === "no" || str === "false" || str === "0") {
                isEligible = false;
                newFieldsAndExtra["eligible"] = "No";
              }
            }

            // Canonical HouseMember payload — NEVER send status to house_members
            const memberPayload = {
              id: memberId,
              house_uuid: houseId,
              member_name: m.name,
              member_id: m.memberId,
              data: newFieldsAndExtra,
              source_files: m.sourceFiles,
              uploaded_by: authenticatedUserId,
              uploaded_at: new Date().toISOString(),
              possible_duplicate: m.matchConfidence < 0.95,
            };

            await db.house_members.add(memberPayload as any);
            memberMutations.push({
              table: "house_members",
              operation: "CREATE",
              payload: memberPayload,
            });
            membersAdded++;

            // Handle Follow-ups
            const followUpRaw =
              newFieldsAndExtra["follow_ups"] ||
              newFieldsAndExtra["followups"] ||
              newFieldsAndExtra["followup"] ||
              "";
            const parsedHistory = parseLegacyFollowUps(followUpRaw);
            const completedHistory = parsedHistory.filter((hist) => hist.status === "completed");

            const seenDates = new Set<string>();

            // 1. Historical completed follow-ups with exact original dates
            for (const hist of completedHistory) {
              if (seenDates.has(hist.dateKey)) continue;
              seenDates.add(hist.dateKey);

              const histCompletedAt =
                parseDateSafe(hist.dateKey)?.toISOString() || `${hist.dateKey}T00:00:00.000Z`;
              const histFupPayload = {
                id: uuidv4(),
                house_uuid: houseId,
                member_uuid: memberId,
                due_date: hist.dateKey,
                status: "completed" as const,
                reason: hist.reason || "Imported historical completed follow-up",
                notes: hist.notes || null,
                risk_level: normalizedRisk || "low",
                created_by: authenticatedUserId,
                completed_at: histCompletedAt,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              await db.follow_ups.add(histFupPayload as any);
              followUpMutations.push({
                table: "follow_ups",
                operation: "CREATE",
                payload: histFupPayload,
              });
            }

            // 2. Next scheduled follow-up: only for eligible members WITH valid clinical risk
            if (
              isEligible &&
              normalizedRisk &&
              ["high", "moderate", "low"].includes(normalizedRisk)
            ) {
              const latestCompletedItem = completedHistory
                .slice()
                .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];

              let anchorDate: Date | null = null;
              if (latestCompletedItem) {
                anchorDate = parseDateSafe(latestCompletedItem.dateKey);
              }
              if (!anchorDate) {
                const surveyDateRaw =
                  newFieldsAndExtra["survey_date"] ||
                  h.fields["survey_date"] ||
                  newFieldsAndExtra["screening_date"];
                anchorDate = parseDateSafe(surveyDateRaw) || new Date();
              }

              const intervals: Record<"low" | "moderate" | "high", number> = {
                high: 15,
                moderate: 30,
                low: 180,
              };

              const nextDueDateStr = calculateNextFollowUpDate(
                anchorDate,
                normalizedRisk as RiskLevel,
                intervals,
              );

              const pendingFupPayload = {
                id: uuidv4(),
                house_uuid: houseId,
                member_uuid: memberId,
                due_date: nextDueDateStr,
                reason: `Imported ${normalizedRisk} risk follow-up`,
                risk_level: normalizedRisk,
                status: "pending" as const,
                created_by: authenticatedUserId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              await db.follow_ups.add(pendingFupPayload as any);
              followUpMutations.push({
                table: "follow_ups",
                operation: "CREATE",
                payload: pendingFupPayload,
              });
            }
          } else if (action === "merge" && m.existingId) {
            const member = await db.house_members.get(m.existingId);
            if (member) {
              const updatedData = { ...(member.data || {}), ...m.fields };

              const updatePayload = {
                id: m.existingId,
                data: updatedData,
                updated_at: new Date().toISOString(),
              };

              await db.house_members.update(m.existingId, updatePayload as any);
              memberMutations.push({
                table: "house_members",
                operation: "UPDATE",
                payload: updatePayload,
              });
              membersMerged++;
            }
          }
        } catch (e: any) {
          errors.push({ type: "member", name: m.name, error: e.message });
        }
      }
    } catch (e: any) {
      errors.push({ type: "house", key: h.key, error: e.message });
    }
  }

  // 2. Strict Dependency Order: Queue ALL houses BEFORE members, and members BEFORE follow_ups
  const allMutations = [...houseMutations, ...memberMutations, ...followUpMutations];
  if (allMutations.length > 0) {
    await OfflineSyncService.queueBatch(allMutations);
  }

  return { housesAdded, housesUpdated, membersAdded, membersMerged, errors };
}
