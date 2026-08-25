import type { RiskLevel } from "./risk";

/**
 * Follow-up scheduling defaults. Admin can override these at runtime through
 * Settings; the values here are only the fallback defaults.
 */
export const followUpConfig = {
  intervalDays: { high: 7, moderate: 30, low: 90 } as Record<RiskLevel, number>,
  /** 0 = Sunday. Sunday is never a working day. */
  workingDays: [1, 2, 3, 4, 5, 6],
  workingHours: { start: "09:00", end: "17:00" },
  defaultDailyTarget: 10,
  statuses: ["due", "completed", "overdue", "skipped", "rescheduled"] as const,
} as const;

export type FollowUpStatus = (typeof followUpConfig.statuses)[number];

/** Shifts a date off Sunday (and any non-working day) to the next working day. */
export function toWorkingDay(date: Date, workingDays: number[] = [...followUpConfig.workingDays]) {
  const d = new Date(date);
  let guard = 0;
  while (!workingDays.includes(d.getDay()) && guard < 14) {
    d.setDate(d.getDate() + 1);
    guard += 1;
  }
  return d;
}

export function nextDueDate(
  from: Date,
  risk: RiskLevel,
  intervals: Record<RiskLevel, number> = followUpConfig.intervalDays,
) {
  const d = new Date(from);
  d.setDate(d.getDate() + intervals[risk]);
  return toWorkingDay(d);
}
