import { tables } from "@/config/database";
import { followUpConfig, nextDueDate, toWorkingDay } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import type { FollowUp } from "@/db/types";
import { toDateKey } from "@/lib/domain";
import { logActivity } from "@/services/activityService";

export interface ScheduleFollowUpInput {
  houseUuid: string | null;
  memberUuid: string | null;
  risk: RiskLevel;
  reason: string;
  dueDate?: Date;
  notes?: string | null;
}

export async function scheduleFollowUp(input: ScheduleFollowUpInput) {
  const due = input.dueDate
    ? toWorkingDay(input.dueDate)
    : nextDueDate(new Date(), input.risk);
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from(tables.followUps)
    .insert({
      house_uuid: input.houseUuid,
      member_uuid: input.memberUuid,
      due_date: toDateKey(due),
      reason: input.reason,
      risk_level: input.risk,
      status: "due",
      notes: input.notes ?? null,
      created_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await logActivity("followup.scheduled", { id: data.id, due_date: data.due_date });
  return data as FollowUp;
}

export async function completeFollowUp(id: string, notes?: string) {
  const { error } = await supabase
    .from(tables.followUps)
    .update({ status: "completed", notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logActivity("followup.completed", { id });
}

export async function rescheduleFollowUp(id: string, date: Date, notes?: string) {
  const { error } = await supabase
    .from(tables.followUps)
    .update({
      status: "rescheduled",
      due_date: toDateKey(toWorkingDay(date)),
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await logActivity("followup.rescheduled", { id, due_date: toDateKey(toWorkingDay(date)) });
}

export async function skipFollowUp(id: string, notes?: string) {
  const { error } = await supabase
    .from(tables.followUps)
    .update({ status: "skipped", notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logActivity("followup.skipped", { id });
}

/** Suggested workload split across the next working days. */
export function planWorkload(count: number, dailyTarget = followUpConfig.defaultDailyTarget) {
  const days: { date: string; load: number }[] = [];
  let remaining = count;
  const cursor = new Date();
  let guard = 0;
  while (remaining > 0 && guard < 60) {
    const day = toWorkingDay(cursor);
    const load = Math.min(dailyTarget, remaining);
    days.push({ date: toDateKey(day), load });
    remaining -= load;
    cursor.setTime(day.getTime());
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return days;
}
