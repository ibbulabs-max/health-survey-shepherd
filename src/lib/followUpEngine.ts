import { riskConfig, type RiskLevel } from "@/config/risk";
import type { FollowUp, HouseMember, MemberAssessment } from "@/db/types";
import type { MemberView } from "@/lib/domain";

// We remove hardcoded ELIGIBLE_AGE and FOLLOW_UP_INTERVALS to rely on DB settings.

/* -------------------------------------------------------------------------- */
/*                           ELIGIBILITY LOGIC                                */
/* -------------------------------------------------------------------------- */

export function isEligibleForFollowUp(
  age: number | null | undefined,
  minEligibleAge: number,
): boolean {
  return age != null && age >= minEligibleAge;
}

/* -------------------------------------------------------------------------- */
/*                           DATE PARSING & FORMATTING                        */
/* -------------------------------------------------------------------------- */

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Safely parses any date representation into a local calendar Date (00:00:00).
 * Prevents timezone off-by-one shifts.
 */
export function parseDateSafe(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }

  const str = String(input).trim();
  if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return null;

  // 1. Check YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]!, 10);
    const month = parseInt(isoMatch[2]!, 10) - 1;
    const day = parseInt(isoMatch[3]!, 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. Check DD MMM YYYY (e.g. 07 Aug 2026, 7 August 2026, 24-Aug-2026)
  const dMmmYMatch = str.match(/^(\d{1,2})[\s\-_]+([A-Za-z]+)[\s\-_]+(\d{4})/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1]!, 10);
    const monthKey = dMmmYMatch[2]!.toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = parseInt(dMmmYMatch[3]!, 10);
    if (month != null) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 3. Check MMM DD, YYYY (e.g. Aug 07, 2026 or August 7 2026)
  const mmmDYMatch = str.match(/^([A-Za-z]+)[\s\-_]+(\d{1,2}),?[\s\-_]+(\d{4})/);
  if (mmmDYMatch) {
    const monthKey = mmmDYMatch[1]!.toLowerCase();
    const month = MONTH_MAP[monthKey];
    const day = parseInt(mmmDYMatch[2]!, 10);
    const year = parseInt(mmmDYMatch[3]!, 10);
    if (month != null) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 4. Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]!, 10);
    const month = parseInt(dmyMatch[2]!, 10) - 1;
    const year = parseInt(dmyMatch[3]!, 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // 5. Fallback Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

/** Formats a date as `YYYY-MM-DD` for keys and database queries. */
export function toDateKeySafe(d: Date | string | null | undefined): string {
  const parsed = parseDateSafe(d);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formats a date cleanly as `DD MMM YYYY` (e.g. `24 Aug 2026`). */
export function formatDisplayDate(input: string | Date | null | undefined): string {
  const parsed = parseDateSafe(input);
  if (!parsed) return "Not available";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = MONTH_NAMES_SHORT[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

/** Formats as `DD MMM YY` for ultra-compact mobile badges (e.g. `10 Mar 26`). */
export function formatCompactDate(input: string | Date | null | undefined): string {
  const parsed = parseDateSafe(input);
  if (!parsed) return "—";
  const day = parsed.getDate();
  const month = MONTH_NAMES_SHORT[parsed.getMonth()];
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

/** Calendar addition: returns a new Date with `days` added. */
export function addDaysCalendar(baseDate: Date | string, days: number): Date {
  const d = parseDateSafe(baseDate) ?? new Date();
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  res.setDate(res.getDate() + days);
  return res;
}

/**
 * Skips Sundays and configured holidays.
 * Returns a valid Date object.
 */
export function calculateNextWorkingDay(
  targetDate: Date,
  holidaysSet?: Set<string>,
  workingDays?: string[],
): Date {
  const current = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  while (true) {
    const dayName = DAY_NAMES[current.getDay()] as string;
    const isNonWorkingDay = workingDays ? !workingDays.includes(dayName) : current.getDay() === 0;
    const dateKey = toDateKeySafe(current);
    const isHoliday = holidaysSet?.has(dateKey) ?? false;

    if (isNonWorkingDay || isHoliday) {
      current.setDate(current.getDate() + 1);
    } else {
      break;
    }
  }

  return current;
}

/**
 * Calculates next follow-up date given a base date and risk level.
 * Returns ISO key `YYYY-MM-DD`.
 */
export function calculateNextFollowUpDate(
  baseDate: Date | string,
  risk: RiskLevel,
  customIntervals: Record<RiskLevel, number>,
  holidaysSet?: Set<string>,
  workingDays?: string[],
): string {
  const interval = customIntervals[risk];
  const targetDate = addDaysCalendar(baseDate, interval);
  const workingDate = calculateNextWorkingDay(targetDate, holidaysSet, workingDays);
  return toDateKeySafe(workingDate);
}

export function calculateRecurringFollowUpDate(
  surveyDate: Date | string,
  risk: RiskLevel,
  customIntervals: Record<RiskLevel, number>,
  occurrenceNumber: number,
  holidaysSet?: Set<string>,
  workingDays?: string[],
): string | null {
  const anchor = parseDateSafe(surveyDate);
  if (!anchor) return null;

  const interval = Math.max(1, customIntervals[risk] ?? 1);
  const occurrence = Math.max(1, occurrenceNumber);
  const targetDate = addDaysCalendar(anchor, interval * occurrence);
  return toDateKeySafe(calculateNextWorkingDay(targetDate, holidaysSet));
}

export function calculateNextRecurringFollowUpDate(
  surveyDate: Date | string | null | undefined,
  risk: RiskLevel,
  customIntervals: Record<RiskLevel, number>,
  holidaysSet?: Set<string>,
  options?: {
    afterDate?: Date | string | null | undefined;
    completedDates?: Iterable<string | Date | null | undefined>;
    workingDays?: string[] | undefined;
  },
): string | null {
  if (!surveyDate) return null;

  const completedDateKeys = new Set<string>();
  for (const completed of options?.completedDates ?? []) {
    const key = toDateKeySafe(completed);
    if (key) completedDateKeys.add(key);
  }

  const latestCompletedDate = Array.from(completedDateKeys).sort().at(-1) ?? null;
  const afterDateKey = options?.afterDate ? toDateKeySafe(options.afterDate) : null;
  const mustBeAfter = [latestCompletedDate, afterDateKey].filter(Boolean).sort().at(-1) ?? null;

  for (let occurrence = 1; occurrence <= 1200; occurrence += 1) {
    const candidate = calculateRecurringFollowUpDate(
      surveyDate,
      risk,
      customIntervals,
      occurrence,
      holidaysSet,
      options?.workingDays,
    );
    if (!candidate) return null;
    if (completedDateKeys.has(candidate)) continue;
    if (mustBeAfter && candidate <= mustBeAfter) continue;
    return candidate;
  }

  return null;
}

/** Returns difference in calendar days (b - a). */
export function daysDiff(a: Date | string, b: Date | string): number {
  const da = parseDateSafe(a);
  const db = parseDateSafe(b);
  if (!da || !db) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((db.getTime() - da.getTime()) / msPerDay);
}

/* -------------------------------------------------------------------------- */
/*                     LEGACY FOLLOW-UP HISTORY PARSER                        */
/* -------------------------------------------------------------------------- */

export interface ParsedFollowUpHistoryItem {
  id?: string | undefined;
  dateKey: string;
  formattedDate: string;
  status: "completed" | "pending" | "missed";
  notes?: string | undefined;
  reason?: string | undefined;
  vitals?:
    | {
        systolic?: number | undefined;
        diastolic?: number | undefined;
        bloodSugar?: number | null | undefined;
      }
    | undefined;
  raw?: string | undefined;
}

/**
 * Parses legacy follow-up string entries such as:
 * "07 Aug 2026 | COMPLETED | Recheck BP | ...\n08 Aug 2026 | COMPLETED | ..."
 * Extracts all valid dates, completion status, and notes.
 */
export function parseLegacyFollowUps(rawText: unknown): ParsedFollowUpHistoryItem[] {
  if (!rawText) return [];
  const text = String(rawText).trim();
  if (!text) return [];

  // Split by newlines, semicolons, or multiple pipe blocks
  const lines = text
    .split(/[\r\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const results: ParsedFollowUpHistoryItem[] = [];

  for (const line of lines) {
    // Look for pipe-separated fields or standard dates
    const parts = line.split("|").map((p) => p.trim());
    const dateCandidate = parts[0] || line;
    const parsedDate = parseDateSafe(dateCandidate);

    if (parsedDate) {
      const dateKey = toDateKeySafe(parsedDate);
      const statusRaw = (parts[1] || "").toLowerCase();
      let status: "completed" | "pending" | "missed" = "completed";
      if (statusRaw.includes("miss") || statusRaw.includes("skip")) {
        status = "missed";
      } else if (statusRaw.includes("pend") || statusRaw.includes("due")) {
        status = "pending";
      }

      const notes = parts.slice(2).join(" | ").trim() || undefined;

      results.push({
        dateKey,
        formattedDate: formatDisplayDate(parsedDate),
        status,
        notes,
        reason: parts[2]?.trim() || "Follow-up visit",
        raw: line,
      });
    }
  }

  return results;
}

/* -------------------------------------------------------------------------- */
/*                   MEMBER FOLLOW-UP SUMMARY & HISTORY                       */
/* -------------------------------------------------------------------------- */

export interface MemberFollowUpSummary {
  memberId: string;
  isEligible: boolean;
  age: number | null;
  currentRisk: RiskLevel;
  surveyDate: string | null;
  surveyDateFormatted: string;
  lastFollowUpDate: string | null;
  lastFollowUpDateFormatted: string;
  nextFollowUpDate: string | null;
  nextFollowUpDateFormatted: string;
  activeFollowUpId?: string | undefined;
  status: "today" | "upcoming" | "overdue" | "completed" | "not_available";
  history: ParsedFollowUpHistoryItem[];
  vitalsToCheck: ("BP" | "Sugar" | "Weight" | "Pulse")[];
}

/**
 * Derives vitals to check for a member based on conditions, history, and screening.
 */
export function deriveVitalsToCheck(
  member: MemberView | null,
): ("BP" | "Sugar" | "Weight" | "Pulse")[] {
  const vitals: ("BP" | "Sugar" | "Weight" | "Pulse")[] = [];
  if (!member) return ["BP", "Pulse"];

  const conditions = (member.conditions ?? []).map((c) => c.toLowerCase());
  const hasHTN = conditions.some(
    (c) => c.includes("hyper") || c.includes("bp") || c.includes("press"),
  );
  const hasDiabetes = conditions.some((c) => c.includes("diabet") || c.includes("sugar"));
  const hasHeartOrAsthma = conditions.some(
    (c) =>
      c.includes("heart") || c.includes("asthma") || c.includes("copd") || c.includes("stroke"),
  );

  vitals.push("BP");
  if (hasDiabetes || (member.bloodSugar != null && member.bloodSugar >= 140)) {
    vitals.push("Sugar");
  }
  if (hasHeartOrAsthma || conditions.length > 0) {
    vitals.push("Weight");
    vitals.push("Pulse");
  } else {
    vitals.push("Pulse");
  }

  return Array.from(new Set(vitals));
}

/**
 * Extracts and unifies all follow-up history, last completed date, and next calculated date
 * for a member by integrating database follow_ups and legacy data fields.
 */
export function extractMemberFollowUpSummary(
  member: MemberView,
  assessment: MemberAssessment | null,
  dbFollowUps: FollowUp[],
  minEligibleAge: number,
  customIntervals: Record<RiskLevel, number>,
  holidaysSet?: Set<string>,
  todayKey: string = toDateKeySafe(new Date()),
  workingDays?: string[],
): MemberFollowUpSummary {
  const isEligible = isEligibleForFollowUp(member.age, minEligibleAge);
  const currentRisk = member.risk;

  // 1. Survey date
  const surveyRaw =
    assessment?.assessed_at ??
    member.screenedAt ??
    (member.extraFields?.["screening_date"] as string | undefined) ??
    (member.extraFields?.["survey_date"] as string | undefined) ??
    null;
  const surveyDateObj = parseDateSafe(surveyRaw);
  const surveyDate = surveyDateObj ? toDateKeySafe(surveyDateObj) : null;
  const surveyDateFormatted = formatDisplayDate(surveyDateObj);

  // 2. Collect completed history entries from DB and legacy fields
  const memberDbFollowUps = dbFollowUps.filter((f) => f.member_uuid === member.id);
  const historyMap = new Map<string, ParsedFollowUpHistoryItem>();

  // Add DB completed follow-ups
  for (const f of memberDbFollowUps) {
    if (f.status === "completed" || f.status === "missed") {
      const dKey = f.due_date
        ? toDateKeySafe(f.due_date)
        : f.updated_at
          ? toDateKeySafe(f.updated_at)
          : "";
      if (dKey) {
        historyMap.set(dKey, {
          id: f.id,
          dateKey: dKey,
          formattedDate: formatDisplayDate(dKey),
          status: f.status as "completed" | "missed",
          notes: f.notes ?? undefined,
          reason: f.reason ?? undefined,
        });
      }
    }
  }

  // Parse and merge legacy follow-ups from extraFields['follow_ups'] or data['follow_ups']
  const legacyRaw = member.extraFields?.["follow_ups"] ?? member.extraFields?.["followup"];
  if (legacyRaw) {
    const parsedLegacy = parseLegacyFollowUps(legacyRaw);
    for (const item of parsedLegacy) {
      if (!historyMap.has(item.dateKey)) {
        historyMap.set(item.dateKey, item);
      }
    }
  }

  // Convert to array and sort newest first (descending)
  const history = Array.from(historyMap.values()).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey),
  );

  // Find last completed date
  const completedHistory = history.filter((h) => h.status === "completed");
  const lastCompletedDate = completedHistory.length > 0 ? completedHistory[0]!.dateKey : null;
  const lastFollowUpDateFormatted = formatDisplayDate(lastCompletedDate);

  // 3. Find next / active follow-up
  const activePending = memberDbFollowUps.find((f) => (f.status ?? "pending") === "pending");

  let nextFollowUpDate: string | null = null;
  const activeFollowUpId: string | undefined = activePending?.id;

  if (activePending?.due_date) {
    nextFollowUpDate = toDateKeySafe(activePending.due_date);
  } else if (isEligible) {
    // Calculate recurring or initial follow-up based on history
    const recurrenceAnchor = surveyDate;
    if (recurrenceAnchor) {
      if (completedHistory.length > 0) {
        // If history exists, calculate directly from the latest completion date
        nextFollowUpDate = calculateNextFollowUpDate(
          lastCompletedDate!,
          currentRisk,
          customIntervals,
          holidaysSet,
          workingDays,
        );
      } else {
        // Initial calculation from survey date
        nextFollowUpDate = calculateNextFollowUpDate(
          recurrenceAnchor,
          currentRisk,
          customIntervals,
          holidaysSet,
          workingDays,
        );
      }
    }
  }

  const nextFollowUpDateFormatted = formatDisplayDate(nextFollowUpDate);

  // 4. Derive Status
  let status: "today" | "upcoming" | "overdue" | "completed" | "not_available" = "not_available";

  if (activePending) {
    const dueKey = activePending.due_date ? toDateKeySafe(activePending.due_date) : "";
    if (dueKey === todayKey) {
      status = "today";
    } else if (dueKey < todayKey) {
      status = "overdue";
    } else {
      status = "upcoming";
    }
  } else if (completedHistory.length > 0) {
    status = "completed";
  } else if (nextFollowUpDate) {
    if (nextFollowUpDate === todayKey) {
      status = "today";
    } else if (nextFollowUpDate < todayKey) {
      status = "overdue";
    } else {
      status = "upcoming";
    }
  }

  const vitalsToCheck = deriveVitalsToCheck(member);

  return {
    memberId: member.id,
    isEligible,
    age: member.age,
    currentRisk,
    surveyDate,
    surveyDateFormatted,
    lastFollowUpDate: lastCompletedDate,
    lastFollowUpDateFormatted,
    nextFollowUpDate,
    nextFollowUpDateFormatted,
    activeFollowUpId,
    status,
    history,
    vitalsToCheck,
  };
}
