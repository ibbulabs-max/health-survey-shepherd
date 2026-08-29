import { tables } from "@/config/database";
import { followUpConfig, nextDueDate, toWorkingDay } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import type { FollowUp } from "@/db/types";
import { toDateKey, calculateRisk } from "@/lib/domain";
import { logActivity } from "@/services/activityService";
import { useSettings } from "@/hooks/useSettings";

export interface ScheduleFollowUpInput {
  houseUuid: string | null;
  memberUuid: string | null;
  risk: RiskLevel;
  reason: string;
  dueDate?: Date;
  notes?: string | null;
  createdBy?: string | null;
}

/**
 * Creates a follow-up record in the database.
 * DB `follow_ups.status` only accepts: pending | completed | missed
 */
export async function scheduleFollowUp(input: ScheduleFollowUpInput) {
  const intervals = useSettings.getState().followUpIntervals;
  const due = input.dueDate
    ? toWorkingDay(input.dueDate)
    : nextDueDate(new Date(), input.risk, intervals);
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from(tables.followUps)
    .insert({
      house_uuid: input.houseUuid,
      member_uuid: input.memberUuid,
      due_date: toDateKey(due),
      reason: input.reason,
      risk_level: input.risk,
      status: "pending", // DB-valid: pending | completed | missed
      notes: input.notes ?? null,
      created_by: input.createdBy ?? auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await logActivity("followup.scheduled", { id: data.id, due_date: data.due_date });
  return data as FollowUp;
}

export async function completeFollowUp(params: {
  id: string;
  notes?: string;
  vitals?: { systolic: number; diastolic: number; bloodSugar: number | null };
  holidays?: string[];
}) {
  const { id, notes, vitals, holidays = [] } = params;

  // 1. Get the current follow-up details to know member, house, risk
  const { data: current, error: fetchError } = await supabase
    .from(tables.followUps)
    .select("*, house_members(data)")
    .eq("id", id)
    .single();
    
  if (fetchError) throw fetchError;
  
  // 2. Mark current as completed
  const { error } = await supabase
    .from(tables.followUps)
    .update({ status: "completed", notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  
  let currentRisk = current.risk_level as RiskLevel;

  // 3. Handle vitals if provided
  if (vitals) {
    const { data: latestAssessment } = await supabase
      .from(tables.memberAssessments)
      .select("*")
      .eq("member_uuid", current.member_uuid)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .single();
      
    // Re-evaluate risk
    const existingConditions = latestAssessment?.known_history 
      ? (typeof latestAssessment.known_history === 'string' 
          ? latestAssessment.known_history.split(',') 
          : latestAssessment.known_history)
      : [];
      
    const newRiskResult = calculateRisk({
      systolic: vitals.systolic,
      diastolic: vitals.diastolic,
      bloodSugar: vitals.bloodSugar,
      conditions: Array.isArray(existingConditions) ? existingConditions : []
    });
    
    currentRisk = newRiskResult.level;
    
    if (latestAssessment) {
      await supabase
        .from(tables.memberAssessments)
        .update({
          systolic: vitals.systolic,
          diastolic: vitals.diastolic,
          blood_sugar: vitals.bloodSugar,
          risk_level: currentRisk,
          updated_at: new Date().toISOString()
        })
        .eq("id", latestAssessment.id);
    } else {
      await supabase
        .from(tables.memberAssessments)
        .insert({
          member_uuid: current.member_uuid,
          house_uuid: current.house_uuid,
          systolic: vitals.systolic,
          diastolic: vitals.diastolic,
          blood_sugar: vitals.bloodSugar,
          risk_level: currentRisk,
          assessed_at: new Date().toISOString()
        });
    }
  }

  // 4. Check eligibility - Age >= 30
  const memberData = (current.house_members as any)?.data as Record<string, unknown> | undefined;
  const age = memberData?.["age"] != null ? Number(memberData["age"]) : null;
  const isEligibleVal = age != null && age >= 30;
  
  // 5. Calculate next follow-up
  if (isEligibleVal && current.house_uuid && current.member_uuid && currentRisk) {
    // Check for existing pending follow-up to prevent duplicates
    const { data: existingPending } = await supabase
      .from(tables.followUps)
      .select("id")
      .eq("member_uuid", current.member_uuid)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (!existingPending) {
      const intervals = useSettings.getState().followUpIntervals;
      const nextDate = nextDueDate(new Date(), currentRisk, intervals, holidays);
      
      await supabase.from(tables.followUps).insert({
        house_uuid: current.house_uuid,
        member_uuid: current.member_uuid,
        due_date: toDateKey(nextDate),
        reason: `Routine ${currentRisk} risk follow-up`,
        risk_level: currentRisk,
        status: "pending",
        created_by: current.created_by,
      });
    }
  }
  
  await logActivity("followup.completed", { id });
}

/**
 * Moves a pending follow-up to the next working day without changing the status.
 * (The DB has no "rescheduled" status — we just update the due_date.)
 */
export async function postponeFollowUp(id: string, date: Date, notes?: string, holidays: string[] = []) {
  const { error } = await supabase
    .from(tables.followUps)
    .update({
      status: "pending",
      due_date: toDateKey(toWorkingDay(date, followUpConfig.workingDays, holidays)),
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await logActivity("followup.postponed", { id, due_date: toDateKey(toWorkingDay(date, followUpConfig.workingDays, holidays)) });
}

/**
 * Marks a follow-up as missed (DB-valid status, replaces the former "skipped").
 */
export async function markFollowUpMissed(id: string, notes?: string) {
  const { error } = await supabase
    .from(tables.followUps)
    .update({ status: "missed", notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logActivity("followup.missed", { id });
}

/** @deprecated Use postponeFollowUp instead */
export const rescheduleFollowUp = postponeFollowUp;

/** @deprecated Use markFollowUpMissed instead */
export const skipFollowUp = markFollowUpMissed;

/** Suggested workload split across the next working days. */
export function planWorkload(count: number, dailyTarget = followUpConfig.defaultDailyTarget) {
  const days: { date: string; load: number }[] = [];
  let remaining = count;
  let cursor = new Date();
  let guard = 0;
  
  // Import dynamically if needed or rely on previous imports if they exist.
  // We'll just use the standard JS for now but with safe addDays approach using the existing date-fns from config if it were there.
  // Actually planWorkload is in followUpService.ts, let's use the standard date-fns addDays since it is available if we import it.
  
  while (remaining > 0 && guard < 60) {
    const day = toWorkingDay(cursor);
    const load = Math.min(dailyTarget, remaining);
    days.push({ date: toDateKey(day), load });
    remaining -= load;
    
    // safe cursor increment
    cursor = new Date(day);
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return days;
}

/**
 * Checks if a member is eligible for follow‑up (age >= 30).
 */
export function isEligible(age: number | null): boolean {
  return age != null && age >= 30;
}

/** Returns interval days for a given risk level. */
export function getRiskInterval(risk: RiskLevel): number {
  const intervals = useSettings.getState().followUpIntervals;
  return intervals[risk] ?? followUpConfig.intervalDays[risk];
}

/**
 * Insert a pending follow‑up if none exists for the member on the target date,
 * otherwise update the existing record (e.g., risk or reason changes).
 */
export async function createOrUpdatePendingFollowUp(params: {
  memberUuid: string;
  houseUuid: string | null;
  risk: RiskLevel;
  reason: string;
  dueDate: Date;
}) {
  const { memberUuid, houseUuid, risk, reason, dueDate } = params;
  const existing = await supabase
    .from(tables.followUps)
    .select("id, due_date")
    .eq("member_uuid", memberUuid)
    .eq("status", "pending")
    .single();
  if (existing.data) {
    // Update if due_date differs or risk changed
    await supabase
      .from(tables.followUps)
      .update({
        house_uuid: houseUuid,
        due_date: toDateKey(dueDate),
        risk_level: risk,
        reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);
  } else {
    await scheduleFollowUp({
      houseUuid,
      memberUuid,
      risk,
      reason,
      dueDate,
    });
  }
}

/** Recalculates pending follow‑up for a member after a new assessment or import. */
export async function recalculatePendingFollowUp(memberUuid: string, holidays: string[] = []) {
  // Fetch member data & most recent assessment
  const { data: member, error: memErr } = await supabase
    .from(tables.houseMembers)
    .select("*, houses!inner(id, house_uuid)")
    .eq("member_uuid", memberUuid)
    .single();
  if (memErr) throw memErr;

  const data = member?.data;
  const age = data && "age" in data ? (data as any).age : null;
  if (!isEligible(age)) return; // not eligible

  // Get latest assessment for vitals
  const { data: assessment } = await supabase
    .from(tables.memberAssessments)
    .select("systolic, diastolic, blood_sugar, risk_level")
    .eq("member_uuid", memberUuid)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .single();
  if (!assessment) return;

  const risk = (assessment.risk_level as RiskLevel) ?? "low";
  const interval = getRiskInterval(risk);
  const baseDate = new Date();
  
  // Use a proper record literal that satisfies Record<RiskLevel, number>
  const intervals: Record<RiskLevel, number> = {
    ...followUpConfig.intervalDays,
    [risk]: interval
  };
  
  const dueDate = nextDueDate(baseDate, risk, intervals, holidays);

  await createOrUpdatePendingFollowUp({
    memberUuid,
    houseUuid: member?.house_uuid ?? null,
    risk,
    reason: `Routine ${risk} risk follow‑up`,
    dueDate,
  });
}

/**
 * Manually update the last follow-up date for a member (from Member Summary).
 * 1. Closes any existing pending follow-up (marks missed/superseded) or creates a completed history record.
 * 2. Calculates the new next follow-up based on current risk and the provided date.
 * 3. Creates exactly one active pending follow-up.
 */
export async function updateLastFollowUpDate(memberUuid: string, lastDateStr: string, riskLevel: RiskLevel, holidays: string[] = []) {
  // 1. Get current pending follow-ups to supersede them
  const { data: pendings } = await supabase
    .from(tables.followUps)
    .select("id")
    .eq("member_uuid", memberUuid)
    .eq("status", "pending");

  // Mark existing pendings as missed/superseded
  if (pendings && pendings.length > 0) {
    for (const p of pendings) {
      await supabase.from(tables.followUps).update({ status: "missed", notes: "Superseded by manual last follow-up date update", updated_at: new Date().toISOString() }).eq("id", p.id);
    }
  }

  // 2. Insert a historical completed record for the given last date
  const { data: member } = await supabase
    .from(tables.houseMembers)
    .select("house_uuid")
    .eq("member_uuid", memberUuid)
    .single();

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  await supabase.from(tables.followUps).insert({
    member_uuid: memberUuid,
    house_uuid: member?.house_uuid ?? null,
    risk_level: riskLevel,
    due_date: lastDateStr,
    status: "completed",
    reason: "Manual history entry",
    notes: "Manual update of last follow-up date",
    created_by: userId,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // 3. Calculate next follow-up
  const baseDate = new Date(lastDateStr + "T00:00:00");
  const interval = getRiskInterval(riskLevel);
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + interval);
  
  const finalDate = toWorkingDay(targetDate, followUpConfig.workingDays, holidays);

  // 4. Create the new pending follow-up
  await supabase.from(tables.followUps).insert({
    member_uuid: memberUuid,
    house_uuid: member?.house_uuid ?? null,
    risk_level: riskLevel,
    reason: `Routine ${riskLevel} risk follow-up`,
    due_date: toDateKey(finalDate),
    status: "pending",
    notes: "Auto-scheduled from manual last follow-up update",
    created_by: userId,
    updated_at: new Date().toISOString(),
  });

  await logActivity("followup.manual_update", { memberUuid, lastDateStr, nextDueDate: toDateKey(finalDate) });
}
