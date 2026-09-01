import { followUpConfig, type FollowUpStatus } from "@/config/followups";
import { priorityWeights, riskConfig, riskOrder, type RiskLevel } from "@/config/risk";
import type { House, HouseMember, MemberAssessment } from "@/db/types";

// Re-export FollowUpStatus so existing consumers that import from domain still work.
export type { FollowUpStatus };

/* -------------------------------------------------------------------------- */
/* Shared domain logic — used by every page. Never duplicate this elsewhere.   */
/* -------------------------------------------------------------------------- */

/**
 * Converts any risk string to the canonical internal RiskLevel.
 * Excel values (LOW/MODERATE/HIGH) and stored values (low/moderate/high) are both handled.
 * "low", "normal", "norm", "" all map to "low" (displayed as "Normal" in UI).
 */
export const asRisk = (value: any): RiskLevel | "missing" | "invalid" => {
  if (value == null || String(value).trim() === "") return "missing";
  const v = String(value).trim().toLowerCase();
  if (v.startsWith("high")) return "high";
  if (v.startsWith("mod") || v.startsWith("med")) return "moderate";
  if (v === "low" || v === "normal" || v === "norm") return "low";
  return "invalid";
};

export const highestRisk = (levels: RiskLevel[]): RiskLevel =>
  levels.reduce<RiskLevel>((acc, l) => (riskOrder[l] > riskOrder[acc] ? l : acc), "low");

export interface RiskResult {
  level: RiskLevel;
  reasons: string[];
}

/** Derives risk from exact readings + conditions using configured thresholds. */
export function calculateRisk(
  input: {
    systolic?: number | null;
    diastolic?: number | null;
    bloodSugar?: number | null;
    conditions?: string[];
  },
  // Optional thresholds override (server may pass DB-configured thresholds). If omitted,
  // fall back to compile-time `riskConfig` defaults so client-side code continues to work.
  thresholds?: {
    bp?: {
      high: { systolic: number; diastolic: number };
      moderate: { systolic: number; diastolic: number };
    };
    sugar?: { high: number; moderate: number };
  },
): RiskResult {
  const reasons: string[] = [];
  let level: RiskLevel = "low";
  const escalate = (to: RiskLevel) => {
    if (riskOrder[to] > riskOrder[level]) level = to;
  };

  const { systolic, diastolic, bloodSugar } = input;
  const cfg = thresholds ?? { bp: riskConfig.bp, sugar: riskConfig.sugar };

  if (systolic != null || diastolic != null) {
    if ((systolic ?? 0) >= cfg.bp!.high.systolic || (diastolic ?? 0) >= cfg.bp!.high.diastolic) {
      escalate("high");
      reasons.push(`BP ${systolic ?? "-"}/${diastolic ?? "-"} at or above high threshold`);
    } else if (
      (systolic ?? 0) >= cfg.bp!.moderate.systolic ||
      (diastolic ?? 0) >= cfg.bp!.moderate.diastolic
    ) {
      escalate("moderate");
      reasons.push(`BP ${systolic ?? "-"}/${diastolic ?? "-"} raised`);
    }
  }

  if (bloodSugar != null) {
    if (bloodSugar >= cfg.sugar!.high) {
      escalate("high");
      reasons.push(`Blood sugar ${bloodSugar} at or above high threshold`);
    } else if (bloodSugar >= cfg.sugar!.moderate) {
      escalate("moderate");
      reasons.push(`Blood sugar ${bloodSugar} raised`);
    }
  }

  return { level, reasons };
}

export const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string")
    return value
      .split(/[,;/|]/)
      .map((s) => s.trim())
      .filter((s) => s && !/^(no|none|nil|na|n\/a|no condition|no known condition)$/i.test(s));
  return [];
};

export const numberOrNull = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/* ----------------------------- member view model --------------------------- */

export interface MemberView {
  id: string;
  memberId: string;
  name: string;
  age: number | null;
  gender: string | null;
  houseUuid: string | null;
  houseId: string | null;
  systolic: number | null;
  diastolic: number | null;
  bloodSugar: number | null;
  conditions: string[];
  risk: RiskLevel;
  riskReasons: string[];
  eligible: boolean;
  screenedAt: string | null;
  assessment: MemberAssessment | null;
  extraFields: Record<string, unknown>;
  dataIssues: string[];
}

export function buildMemberView(
  member: HouseMember,
  assessment: MemberAssessment | null,
  house?: House | null,
  minEligibleAge: number = 30, // Fallback if settings aren't loaded yet
  thresholds?: Parameters<typeof calculateRisk>[1],
): MemberView {
  const data = (member.data ?? {}) as Record<string, unknown>;
  const age = numberOrNull(data["age"]);
  const gender = (data["gender"] as string | undefined) ?? null;

  const conditionsRaw = assessment ? assessment.known_history : data["known_history"];
  const conditions = toStringArray(conditionsRaw);
  const hasExplicitNone =
    typeof conditionsRaw === "string" &&
    /^(no|none|nil|na|n\/a|no condition|no known condition)$/i.test(conditionsRaw.trim());

  const systolic = assessment?.systolic ?? numberOrNull(data["systolic"]);
  const diastolic = assessment?.diastolic ?? numberOrNull(data["diastolic"]);
  const bloodSugar = assessment?.blood_sugar ?? numberOrNull(data["blood_sugar"]);

  const parsed = assessment?.risk_level ? asRisk(assessment.risk_level) : "missing";
  const stored = parsed === "high" || parsed === "moderate" || parsed === "low" ? parsed : null;
  const computed = calculateRisk({ systolic, diastolic, bloodSugar, conditions }, thresholds);
  const risk = stored ?? computed.level;

  const dataIssues: string[] = [];
  if (!member.member_name) dataIssues.push("Missing name");
  if (age == null) dataIssues.push("Missing age");
  if (!gender) dataIssues.push("Missing gender");
  if (systolic == null || diastolic == null) dataIssues.push("Missing BP");
  if (bloodSugar == null) dataIssues.push("Missing sugar");
  if (
    conditions.length === 0 &&
    !hasExplicitNone &&
    ((systolic ?? 0) >= riskConfig.bp.high.systolic ||
      (bloodSugar ?? 0) >= riskConfig.sugar.high ||
      Boolean(assessment?.medication && toStringArray(assessment.medication).length))
  )
    dataIssues.push("Known condition may be missing");
  if (systolic != null && (systolic < 60 || systolic > 260)) dataIssues.push("Invalid BP reading");
  if (bloodSugar != null && (bloodSugar < 20 || bloodSugar > 700))
    dataIssues.push("Invalid sugar reading");
  if (member.possible_duplicate) dataIssues.push("Possible duplicate record");

  const known = new Set([
    "age",
    "gender",
    "systolic",
    "diastolic",
    "blood_sugar",
    "known_history",
    "member_name",
    "member_id",
    "house_id",
  ]);
  const extraFields = Object.fromEntries(
    Object.entries(data).filter(([k]) => !known.has(k)),
  ) as Record<string, unknown>;

  return {
    id: member.id,
    memberId: member.member_id ?? "—",
    name: member.member_name ?? "Unnamed member",
    age,
    gender,
    houseUuid: member.house_uuid,
    houseId: house?.house_id ?? (data["house_id"] as string | undefined) ?? null,
    systolic,
    diastolic,
    bloodSugar,
    conditions,
    risk,
    riskReasons: computed.reasons,
    eligible: age != null && age >= minEligibleAge,
    screenedAt: assessment?.assessed_at ?? null,
    assessment,
    extraFields,
    dataIssues,
  };
}

export interface HouseView {
  house: House;
  members: MemberView[];
  risk: RiskLevel;
  counts: Record<RiskLevel, number>;
  eligible: number;
  screened: number;
  pendingFollowUps: number;
  lastScreening: string | null;
  hasLocation: boolean;
  dataIssues: number;
}

export function buildHouseView(
  house: House,
  members: MemberView[],
  pendingFollowUps = 0,
): HouseView {
  const counts: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0 };
  members.forEach((m) => {
    counts[m.risk] += 1;
  });
  const screenings = members.map((m) => m.screenedAt).filter(Boolean) as string[];
  return {
    house,
    members,
    risk: highestRisk(members.map((m) => m.risk)),
    counts,
    eligible: members.filter((m) => m.eligible).length,
    screened: members.filter((m) => m.screenedAt).length,
    pendingFollowUps,
    lastScreening: screenings.sort().at(-1) ?? null,
    hasLocation: house.latitude != null && house.longitude != null,
    dataIssues: members.reduce((n, m) => n + m.dataIssues.length, 0),
  };
}

/* ------------------------------- follow-ups -------------------------------- */

export const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Derives the display-level follow-up status from DB status + due_date comparison.
 * DB only stores: pending | completed | missed
 * Display derives: today | upcoming | overdue | completed | missed
 */
export const followUpStatus = (status: string | null, dueDate: string | null): FollowUpStatus => {
  const s = (status ?? "pending").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "missed") return "missed";
  // status=="pending" — derive today/upcoming/overdue from due_date
  const today = toDateKey(new Date());
  if (!dueDate) return "overdue";
  if (dueDate === today) return "today";
  if (dueDate > today) return "upcoming";
  return "overdue";
};

export const isWorkingNow = (
  now = new Date(),
  hours = followUpConfig.workingHours,
  days: number[] = [...followUpConfig.workingDays],
) => {
  if (!days.includes(now.getDay())) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return minutes >= parse(hours.start) && minutes <= parse(hours.end);
};

export function priorityScore(input: {
  risk: RiskLevel;
  overdueDays?: number;
  conditions?: number;
  dataIssues?: number;
  missingCondition?: boolean;
}) {
  let score = 0;
  if (input.risk === "high") score += priorityWeights.highRisk;
  if (input.risk === "moderate") score += priorityWeights.moderateRisk;
  score += Math.max(0, input.overdueDays ?? 0) * priorityWeights.overdueFollowUpPerDay;
  if ((input.conditions ?? 0) >= riskConfig.multipleConditionsThreshold)
    score += priorityWeights.multipleConditions;
  if (input.missingCondition) score += priorityWeights.missingCondition;
  score += (input.dataIssues ?? 0) * priorityWeights.dataQualityIssue;
  return score;
}

/* --------------------------- identity matching ----------------------------- */

export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const distance = levenshtein(x, y);
  return Math.max(0, 1 - distance / Math.max(x.length, y.length));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i, ...Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}
