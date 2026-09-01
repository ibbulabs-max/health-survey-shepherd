import { tables } from "@/config/database";
import { followUpConfig } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import type { FollowUp } from "@/db/types";
import { calculateRisk } from "@/lib/domain";
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
 * Intervals: high=15d, moderate=30d, low=180d (low displayed as Normal in UI).
 */
export function getRiskInterval(risk: RiskLevel): number {
  const intervals = useSettings.getState().followUpIntervals;
  // Risk key "low" matches Excel LOW (displayed as Normal). Falls back to config.
  return intervals?.[risk] ?? followUpConfig.intervalDays[risk] ?? 180;
}

/**
 * Checks if a member is eligible for follow‑up (strictly age >= 30).
 */
export function isEligible(age: number | null | undefined): boolean {
  const minEligibleAge = useSettings.getState().minEligibleAge;
  return isEligibleForFollowUp(age, minEligibleAge);
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

  let currentRisk = (current.risk_level as RiskLevel) || "low";

  // 3. Dynamic Vitals / Risk Loop
  let latestAssessment: any = null;
  if (vitals || riskLevel) {
    const { data } = await supabase
      .from(tables.memberAssessments)
      .select("*")
      .eq("member_uuid", current.member_uuid)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestAssessment = data;
  }

  if (vitals) {

    const existingConditions = latestAssessment?.known_history
      ? typeof latestAssessment.known_history === "string"
        ? latestAssessment.known_history.split(",")
        : latestAssessment.known_history
      : [];

    // Use DB-configured thresholds when available (server authoritative)
    const s = useSettings.getState().thresholds;
    let thresholds;
    if (s) {
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
    }

    const newRiskResult = calculateRisk(
      {
        systolic: vitals.systolic,
        diastolic: vitals.diastolic,
        bloodSugar: vitals.bloodSugar,
        conditions: Array.isArray(existingConditions) ? existingConditions : [],
      },
      thresholds,
    );

    // Override with manual riskLevel if provided
    if (riskLevel) {
      currentRisk = riskLevel;
    } else {
      currentRisk = newRiskResult.level;
    }

    if (latestAssessment) {
      await supabase
        .from(tables.memberAssessments)
        .update({
          systolic: vitals.systolic,
          diastolic: vitals.diastolic,
          blood_sugar: vitals.bloodSugar,
          risk_level: currentRisk,
          updated_at: completedAt,
        })
        .eq("id", latestAssessment.id);
    } else {
      await supabase.from(tables.memberAssessments).insert({
        member_uuid: current.member_uuid,
        house_uuid: current.house_uuid,
        systolic: vitals.systolic,
        diastolic: vitals.diastolic,
        blood_sugar: vitals.bloodSugar,
        risk_level: currentRisk,
        assessed_at: completedAt,
      });
    }
  } else {
    // If no vitals were provided but a risk level was selected manually
    if (riskLevel) {
      currentRisk = riskLevel;
      
      if (latestAssessment) {
        await supabase
          .from(tables.memberAssessments)
          .update({
            risk_level: currentRisk,
            updated_at: completedAt,
          })
          .eq("id", latestAssessment.id);
      } else {
        await supabase.from(tables.memberAssessments).insert({
          member_uuid: current.member_uuid,
          house_uuid: current.house_uuid,
          risk_level: currentRisk,
          assessed_at: completedAt,
        });
      }
    }
  }
  // NOTE: If vitals were skipped, currentRisk remains unchanged! Never downgrade or assume normal.

  // 4. Check eligibility - Excel field first, then Age >= 30
  const memberData = (current.house_members as any)?.data as Record<string, unknown> | undefined;

  let eligible = false;
  const eligibleRaw = memberData?.["eligible"] ?? memberData?.["Eligible (≥30)"];
  if (eligibleRaw != null && String(eligibleRaw).trim() !== "") {
    eligible = String(eligibleRaw).trim().toLowerCase() === "yes";
  } else {
    const age = memberData?.["age"] != null ? Number(memberData["age"]) : null;
    eligible = isEligible(age);
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
        // Fall back to frontend state if fetch fails
      }

      // Use the recorded completion timestamp as the recurrence anchor
      // so next follow-up is calculated from the actual completed date.
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
 */
export async function recalculatePendingFollowUp(memberUuid: string) {
  const { data: member, error: memErr } = await supabase
    .from(tables.houseMembers)
    .select("*, houses!inner(id, house_uuid)")
    .eq("id", memberUuid)
    .single();
  if (memErr) throw memErr;

  const data = (member?.data ?? {}) as Record<string, any>;
  const age = data["age"] != null ? Number(data["age"]) : null;
  if (!isEligible(age)) return; // not eligible

  const { data: assessment } = await supabase
    .from(tables.memberAssessments)
    .select("systolic, diastolic, blood_sugar, risk_level, assessed_at")
    .eq("member_uuid", memberUuid)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const risk = (assessment?.risk_level as RiskLevel) ?? "low";
  const s = useSettings.getState();
  const intervals = s.followUpIntervals;
  let holidaysSet: Set<string> | undefined;
  const workingDays = s.thresholds?.working_days;

  try {
    const { fetchHolidays } = await import("@/services/holidayService");
    const holidaysList = await fetchHolidays();
    holidaysSet = new Set(holidaysList.map((h) => h.holiday_date));
  } catch (e) {
    // Fall back to frontend state if fetch fails
  }

  const { data: lastCompleted } = await supabase
    .from(tables.followUps)
    .select("completed_at")
    .eq("member_uuid", memberUuid)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
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
  const age = memberData["age"] != null ? Number(memberData["age"]) : null;

  if (isEligible(age)) {
    const s = useSettings.getState();
    const intervals = s.followUpIntervals;
    let holidaysSet: Set<string> | undefined;
    const workingDays = s.thresholds?.working_days;

    try {
      const { fetchHolidays } = await import("@/services/holidayService");
      const holidaysList = await fetchHolidays();
      holidaysSet = new Set(holidaysList.map((h) => h.holiday_date));
    } catch (e) {
      // Fall back to frontend state if fetch fails
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
