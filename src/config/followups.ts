import type { RiskLevel } from "./risk";

/**
 * Follow-up scheduling defaults. Admin can override these at runtime through
 * Settings; the values here are only the fallback defaults.
 *
 * IMPORTANT: The DB `follow_ups.status` column only accepts:
 *   pending | completed | missed
 * "due" and "overdue" are DERIVED display states (from status + due_date),
 * never stored in the database.
 */
export const followUpConfig = {
  /** Risk-based re-visit intervals per spec: High=15d, Moderate=30d, Low=180d */
  intervalDays: { high: 15, moderate: 30, low: 180 } as Record<RiskLevel, number>,
  /** 0 = Sunday. Sunday is never a working day. */
  workingDays: [1, 2, 3, 4, 5, 6],
  workingHours: { start: "09:00", end: "17:00" },
  defaultDailyTarget: 10,
  /** Valid values that can be STORED in the database. */
  dbStatuses: ["pending", "completed", "missed"] as const,
} as const;

/** Statuses that exist in the database. */
export type FollowUpDbStatus = (typeof followUpConfig.dbStatuses)[number];

/**
 * Display-level statuses (a superset of DB statuses).
 * "due" and "overdue" are derived from status=="pending" + due_date comparison.
 */
export type FollowUpStatus = "due" | "overdue" | "completed" | "missed";

import { addDays, isWeekend, format, parseISO } from "date-fns";

/** Shifts a date off Sunday (and any non-working day) to the next working day. */
export function toWorkingDay(date: Date, workingDays: readonly number[] = followUpConfig.workingDays, holidays: string[] = []) {
  let d = new Date(date);
  let guard = 0;
  
  while (guard < 30) {
    const dayOfWeek = d.getDay();
    const isWorkingDay = workingDays.includes(dayOfWeek);
    const dateStr = format(d, "yyyy-MM-dd");
    const isHoliday = holidays.includes(dateStr);

    if (isWorkingDay && !isHoliday) {
      break;
    }
    d = addDays(d, 1);
    guard += 1;
  }
  return d;
}

export function nextDueDate(
  from: Date,
  risk: RiskLevel,
  intervals: Record<RiskLevel, number> = followUpConfig.intervalDays,
  holidays: string[] = []
) {
  const d = addDays(from, intervals[risk]);
  return toWorkingDay(d, followUpConfig.workingDays, holidays);
}
