import { tables } from "@/config/database";
import { followUpConfig } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import type { FollowUp } from "@/db/types";
import {
  calculateNextFollowUpDate,
  isEligibleForFollowUp,
  parseDateSafe,
  toDateKeySafe,
} from "@/lib/followUpEngine";
import { logActivity } from "@/services/activityService";
import { useSettings } from "@/hooks/useSettings";

export interface ScheduleFollowUpInput {
  houseUuid: string | null;
  memberUuid: string | null;
  risk: RiskLevel;
  reason: string;
  dueDate?: Date | string;
  notes?: string | null;
  createdBy?: string | null;
}

/**
 * Returns interval days for a given risk level.
 * Uses admin-configured intervals from settings; falls back to static config defaults.
 *
 * Intervals (defaults):
 *   high     = 15 days
 *   moderate = 30 days
 *   low      = 180 days
 *
 * "low" includes members whose Excel Clinical Risk was "Normal" (normalized to "low").
 */
export function getRiskInterval(risk: RiskLevel): number {
  const intervals = useSettings.getState().followUpIntervals;
  return intervals?.[risk] ?? followUpConfig.intervalDays[risk] ?? 180;
}

/**
 * Checks if a member is eligible for follow‑up based on the boolean flag.
 */
export function isEligible(eligibleFlag: boolean): boolean {
  return isEligibleForFollowUp(eligibleFlag);
}

/**
 * Creates a follow-up record in the database.
 * DB `follow_ups.status` accepts: pending | completed | missed
 */
export async function scheduleFollowUp(input: ScheduleFollowUpInput) {
  const intervals = useSettings.getState().followUpIntervals;
  const dueDateKey = input.dueDate
    ? toDateKeySafe(input.dueDate)
    : calculateNextFollowUpDate(new Date(), input.risk, intervals);

  const { data: auth } = await supabase.auth.getUser();
  const userId = input.createdBy ?? auth.user?.id ?? null;

  const { data: existingPending } = await supabase
    .from(tables.followUps)
    .select("id, due_date")
    .eq("member_uuid", input.memberUuid)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    // Return existing instead of throwing or duplicating
    return existingPending as FollowUp;
  }

  const { data, error } = await supabase
    .from(tables.followUps)
    .insert({
      house_uuid: input.houseUuid,
      member_uuid: input.memberUuid,
      due_date: dueDateKey,
      reason: input.reason,
      risk_level: input.risk,
      status: "pending",
      notes: input.notes ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) throw error;
  await logActivity("followup.scheduled", { id: data.id, due_date: data.due_date });

  // Synchronize task
  await supabase.from(tables.tasks).insert({
    house_uuid: input.houseUuid,
    member_uuid: input.memberUuid,
    follow_up_id: data.id,
    task_type: "follow_up",
    status: "pending",
    due_date: data.due_date,
    created_by: userId,
  });

  return data as FollowUp;
}

/**
 * Completes a follow-up and schedules the next one.
 *
 * CLINICAL RISK RULES:
 * - If the user explicitly selects a new riskLevel during completion → use that value.
 * - If vitals are provided WITHOUT a riskLevel → store vitals only. Do NOT derive risk.
 * - The canonical risk comes from riskLevel parameter ONLY.
 * - Vitals are stored independently and never override clinical risk.
 *
 * FLOW:
 * 1. Mark current follow-up as completed.
 * 2. If riskLevel provided → update member_assessments.risk_level.
 * 3. If vitals provided → update vitals fields in member_assessments.
 * 4. If eligible → create next follow-up using currentRisk + configured interval.
 */
export async function completeFollowUp(params: {
  id: string;
  notes?: string | undefined;
  vitals?: { systolic: number; diastolic: number; bloodSugar: number | null } | undefined;
  riskLevel?: RiskLevel | undefined;
}) {
  const { id, notes, vitals, riskLevel } = params;

  // 1. Get current follow-up details
  const { data: current, error: fetchError } = await supabase
    .from(tables.followUps)
    .select("*, house_members(id, data)")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  const completedAt = new Date().toISOString();

  // 2. Mark current follow-up as completed
  const { error } = await supabase
    .from(tables.followUps)
    .update({
      status: "completed",
      notes: notes ?? current.notes ?? null,
      updated_at: completedAt,
      completed_at: completedAt,
    })
    .eq("id", id);
  if (error) throw error;

  // Update associated task status
  await supabase
    .from(tables.tasks)
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("follow_up_id", id);

  // 3. Determine canonical current risk
  // RULE: Use the user's explicitly selected riskLevel.
  //       If not provided, preserve the existing risk from house_members.data.clinical_risk.
  //       NEVER derive risk from vitals or assessment fallbacks.
  const memberData = (current.house_members as any)?.data as Record<string, unknown> | undefined;
  const existingRisk = (memberData?.["clinical_risk"] as RiskLevel | null) ?? null;
  const currentRisk: RiskLevel | null = riskLevel ?? existingRisk;

  const { data: latestAssessment } = await supabase
    .from(tables.memberAssessments)
    .select("*")
    .eq("member_uuid", current.member_uuid)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Update member_assessments record with new data
  if (vitals || riskLevel) {
    const assessmentUpdate: Record<string, unknown> = {
      updated_at: completedAt,
    };

    // If a new risk level was selected, store it canonically
    if (riskLevel) {
      (assessmentUpdate as any)["risk_level"] = riskLevel;
    }
    if (vitals) {
      (assessmentUpdate as any)["systolic"] = vitals.systolic;
      (assessmentUpdate as any)["diastolic"] = vitals.diastolic;
      (assessmentUpdate as any)["blood_sugar"] = vitals.bloodSugar;
    }

    if (latestAssessment) {
      await supabase
        .from(tables.memberAssessments)
        .update(assessmentUpdate)
        .eq("id", latestAssessment.id);
    } else {
      // No existing assessment — create one with what we have
      await supabase.from(tables.memberAssessments).insert({
        member_uuid: current.member_uuid,
        house_uuid: current.house_uuid,
        ...(riskLevel ? { risk_level: riskLevel } : {}),
        ...(vitals
          ? {
              systolic: vitals.systolic,
              diastolic: vitals.diastolic,
              blood_sugar: vitals.bloodSugar,
            }
          : {}),
        assessed_at: completedAt,
      });
    }

    // ── CANONICAL CLINICAL RISK PERSISTENCE ──────────────────────────
    // If the CHW explicitly selects a new Risk Level during follow-up,
    // we MUST save it as the new canonical source of truth in house_members.
    if (riskLevel && current.member_uuid) {
      const updatedData = { ...((current.house_members as any)?.data || {}) };
      updatedData.clinical_risk = riskLevel;

      await supabase
        .from(tables.houseMembers)
        .update({ data: updatedData, updated_at: completedAt })
        .eq("id", current.member_uuid);
    }
    // ──────────────────────────────────────────────────────────────────
  }

  // 4. Check eligibility — Excel field first ONLY
  let eligible = false;
  const eligibleRaw =
    memberData?.["eligible"] ?? memberData?.["Eligible (≥30)"] ?? memberData?.["eligible_30"];
  if (eligibleRaw != null && String(eligibleRaw).trim() !== "") {
    eligible = String(eligibleRaw).trim().toLowerCase() === "yes";
  } else {
    // If eligibility is missing, treat it as missing/data-quality information. Do not silently assume Yes.
    eligible = false;
  }

  // 5. Automatically generate next recurring follow-up if eligible
  if (eligible && current.house_uuid && current.member_uuid && currentRisk) {
    const { data: existingPending } = await supabase
      .from(tables.followUps)
      .select("id")
      .eq("member_uuid", current.member_uuid)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (!existingPending) {
      const s = useSettings.getState();
      const intervals = s.followUpIntervals;
      let holidaysSet: Set<string> | undefined;
      const workingDays = s.thresholds?.working_days;

      try {
        const { fetchHolidays } = await import("@/services/holidayService");
        const holidaysList = await fetchHolidays();
        holidaysSet = new Set(holidaysList.map((h) => h.holiday_date));
      } catch (e) {
        // Fall back to static config if fetch fails
      }

      // Next follow-up is anchored from the actual completion date
      const nextDateKey = calculateNextFollowUpDate(
        completedAt,
        currentRisk,
        intervals,
        holidaysSet,
        workingDays,
      );

      const { data: newFup } = await supabase
        .from(tables.followUps)
        .insert({
          house_uuid: current.house_uuid,
          member_uuid: current.member_uuid,
          due_date: nextDateKey,
          reason: `Routine ${currentRisk} risk follow-up`,
          risk_level: currentRisk,
          status: "pending",
          created_by: current.created_by,
        })
        .select("id")
        .single();

      if (newFup) {
        await supabase.from(tables.tasks).insert({
          house_uuid: current.house_uuid,
          member_uuid: current.member_uuid,
          follow_up_id: newFup.id,
          task_type: "follow_up",
          status: "pending",
          due_date: nextDateKey,
          created_by: current.created_by,
        });
      }
    }
  }

  await logActivity("followup.completed", { id, risk: currentRisk });
}

/**
 * Moves a pending follow-up to a new date without changing status or duplicating.
 */
export async function postponeFollowUp(id: string, date: Date | string, notes?: string) {
  const dateKey = toDateKeySafe(date);
  const updatedAt = new Date().toISOString();

  const { error } = await supabase
    .from(tables.followUps)
    .update({
      status: "pending",
      due_date: dateKey,
      notes: notes ?? null,
      updated_at: updatedAt,
    })
    .eq("id", id);
  if (error) throw error;

  await supabase
    .from(tables.tasks)
    .update({
      due_date: dateKey,
      updated_at: updatedAt,
    })
    .eq("follow_up_id", id);

  await logActivity("followup.postponed", { id, due_date: dateKey });
}

export const rescheduleFollowUp = postponeFollowUp;

/**
 * Marks a follow-up as missed.
 */
export async function markFollowUpMissed(id: string, notes?: string) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from(tables.followUps)
    .update({
      status: "missed",
      notes: notes ?? null,
      updated_at: updatedAt,
    })
    .eq("id", id);
  if (error) throw error;

  await supabase
    .from(tables.tasks)
    .update({
      status: "missed",
      updated_at: updatedAt,
    })
    .eq("follow_up_id", id);

  await logActivity("followup.missed", { id });
}

export const skipFollowUp = markFollowUpMissed;

/**
 * Recalculates pending follow‑up for a member after a new assessment or import.
 * Uses canonical risk from member_assessments.risk_level ONLY.
 * If risk is missing from DB, does NOT create a follow-up (no false-positive scheduling).
 */
export async function recalculatePendingFollowUp(memberUuid: string) {
  const { data: member, error: memErr } = await supabase
    .from(tables.houseMembers)
    .select("*, houses!inner(id, house_uuid)")
    .eq("id", memberUuid)
    .single();
  if (memErr) throw memErr;

  // Check eligibility — Excel field ONLY
  const memberData = (member?.data ?? {}) as Record<string, any>;
  const eligibleRaw =
    memberData["eligible"] ?? memberData["Eligible (≥30)"] ?? memberData["eligible_30"];
  let eligible = false;
  if (eligibleRaw != null && String(eligibleRaw).trim() !== "") {
    eligible = String(eligibleRaw).trim().toLowerCase() === "yes";
  } else {
    // Do not fallback to age if missing
    eligible = false;
  }

  if (!eligible) return; // Not eligible — no follow-up

  // Get canonical clinical risk from the member's data
  const rawRisk = memberData["clinical_risk"];

  // If no valid risk is recorded, do NOT create a follow-up with a fabricated risk
  if (!rawRisk || rawRisk === "missing" || rawRisk === "invalid") {
    // No valid Clinical Risk — cannot schedule follow-up with unknown interval
    return;
  }

  // Normalize the stored value (handles "High" → "high" etc.)
  const riskState = rawRisk.trim().toLowerCase();
  if (riskState !== "low" && riskState !== "moderate" && riskState !== "high") {
    return; // Unrecognised value — skip
  }
  const risk = riskState as RiskLevel;

  const s = useSettings.getState();
  const intervals = s.followUpIntervals;
  let holidaysSet: Set<string> | undefined;
  const workingDays = s.thresholds?.working_days;

  try {
    const { fetchHolidays } = await import("@/services/holidayService");
    const holidaysList = await fetchHolidays();
    holidaysSet = new Set(holidaysList.map((h) => h.holiday_date));
  } catch (e) {
    // Fall back to static config
  }

  // Anchor from last completion or from assessment date
  const { data: lastCompleted } = await supabase
    .from(tables.followUps)
    .select("completed_at")
    .eq("member_uuid", memberUuid)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch latest assessment for fallback date if needed
  const { data: assessment } = await supabase
    .from(tables.memberAssessments)
    .select("assessed_at")
    .eq("member_uuid", memberUuid)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseDate = lastCompleted?.completed_at
    ? parseDateSafe(lastCompleted.completed_at)
    : assessment?.assessed_at
      ? parseDateSafe(assessment.assessed_at)
      : new Date();

  const nextDueDateKey = calculateNextFollowUpDate(
    baseDate || new Date(),
    risk,
    intervals,
    holidaysSet,
    workingDays,
  );

  const existing = await supabase
    .from(tables.followUps)
    .select("id, due_date")
    .eq("member_uuid", memberUuid)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.data) {
    await supabase
      .from(tables.followUps)
      .update({
        due_date: nextDueDateKey,
        risk_level: risk,
        reason: `Routine ${risk} risk follow‑up`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);

    await supabase
      .from(tables.tasks)
      .update({
        due_date: nextDueDateKey,
        updated_at: new Date().toISOString(),
      })
      .eq("follow_up_id", existing.data.id);
  } else {
    await scheduleFollowUp({
      houseUuid: member?.house_uuid ?? null,
      memberUuid,
      risk,
      reason: `Routine ${risk} risk follow‑up`,
      dueDate: nextDueDateKey,
    });
  }
}

/**
 * Manually updates the last follow-up date for a member (from Member Profile).
 * 1. Closes any existing pending follow-up (superseded).
 * 2. Inserts a completed history record.
 * 3. Calculates the next follow-up based on current risk and the provided last date.
 * 4. Creates exactly one active pending follow-up and synchronized task.
 */
export async function updateLastFollowUpDate(
  memberUuid: string,
  lastDateStr: string,
  riskLevel: RiskLevel,
) {
  // 1. Get current pending follow-ups to supersede
  const { data: pendings } = await supabase
    .from(tables.followUps)
    .select("id")
    .eq("member_uuid", memberUuid)
    .eq("status", "pending");

  if (pendings && pendings.length > 0) {
    for (const p of pendings) {
      await supabase
        .from(tables.followUps)
        .update({
          status: "missed",
          notes: "Superseded by manual last follow-up date update",
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
    }
  }

  // 2. Fetch member to check eligibility and house_uuid
  const { data: member } = await supabase
    .from(tables.houseMembers)
    .select("house_uuid, data")
    .eq("id", memberUuid)
    .single();

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const nowIso = new Date().toISOString();

  // 3. Insert historical completed record
  await supabase.from(tables.followUps).insert({
    member_uuid: memberUuid,
    house_uuid: member?.house_uuid ?? null,
    risk_level: riskLevel,
    due_date: toDateKeySafe(lastDateStr),
    status: "completed",
    reason: "Manual history entry",
    notes: "Manual update of last follow-up date",
    created_by: userId,
    completed_at: nowIso,
    updated_at: nowIso,
  });

  // 4. Check eligibility before scheduling next
  const memberData = (member?.data ?? {}) as Record<string, any>;
  const eligibleRaw =
    memberData["eligible"] ?? memberData["Eligible (≥30)"] ?? memberData["eligible_30"];
  let eligible = false;
  if (eligibleRaw != null && String(eligibleRaw).trim() !== "") {
    eligible = String(eligibleRaw).trim().toLowerCase() === "yes";
  } else {
    eligible = false;
  }

  if (eligible) {
    const s = useSettings.getState();
    const intervals = s.followUpIntervals;
    let holidaysSet: Set<string> | undefined;
    const workingDays = s.thresholds?.working_days;

    try {
      const { fetchHolidays } = await import("@/services/holidayService");
      const holidaysList = await fetchHolidays();
      holidaysSet = new Set(holidaysList.map((h) => h.holiday_date));
    } catch (e) {
      // Fall back to static config
    }

    const nextDateKey = calculateNextFollowUpDate(
      lastDateStr,
      riskLevel,
      intervals,
      holidaysSet,
      workingDays,
    );

    const { data: insertedFup } = await supabase
      .from(tables.followUps)
      .insert({
        member_uuid: memberUuid,
        house_uuid: member?.house_uuid ?? null,
        risk_level: riskLevel,
        reason: `Routine ${riskLevel} risk follow-up`,
        due_date: nextDateKey,
        status: "pending",
        notes: "Auto-scheduled from manual last follow-up update",
        created_by: userId,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (insertedFup) {
      await supabase.from(tables.tasks).insert({
        house_uuid: member?.house_uuid ?? null,
        member_uuid: memberUuid,
        follow_up_id: insertedFup.id,
        task_type: "follow_up",
        status: "pending",
        due_date: nextDateKey,
        created_by: userId,
      });
    }

    await logActivity("followup.manual_update", {
      memberUuid,
      lastDateStr,
      nextDueDate: nextDateKey,
    });
  }
}
