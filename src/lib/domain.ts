import { followUpConfig, type FollowUpStatus } from "@/config/followups";
import { priorityWeights, riskConfig, riskOrder, type RiskLevel } from "@/config/risk";
import type { House, HouseMember, MemberAssessment } from "@/db/types";

// Re-export FollowUpStatus so existing consumers that import from domain still work.
export type { FollowUpStatus };

/* -------------------------------------------------------------------------- */
/* Shared domain logic — used by every page. Never duplicate this elsewhere.   */
/* -------------------------------------------------------------------------- */

/**
 * The canonical Clinical Risk state for a member.
 *
 * "low" | "moderate" | "high"  — valid, stored clinical risk from Excel/CHW.
 * "missing"                    — risk_level is null/empty in DB.
 * "invalid"                    — risk_level has an unrecognised garbage value.
 *
 * RULE: "missing" and "invalid" must NEVER be silently converted to "low".
 * They must remain as-is so Dashboard/Analytics counts are not falsified.
 */
export type ClinicalRiskState = RiskLevel | "missing" | "invalid";

/**
 * Converts any risk string to the canonical ClinicalRiskState.
 *
 * Normalization rules (from Excel/DB → canonical):
 *   "High" / "HIGH" / "high"         → "high"
 *   "Moderate" / "MODERATE" / "mod…" → "moderate"
 *   "Low" / "LOW" / "low"            → "low"
 *   "Normal" / "NORMAL" / "norm"     → "low"   (the ONLY valid default: Excel "Normal" = Low)
 *   null / "" / undefined             → "missing"
 *   anything else                     → "invalid"
 *
 * IMPORTANT: This function NEVER derives risk from vitals.
 * It only parses a string label.
 */
export const asRisk = (value: any): ClinicalRiskState => {
  if (value == null || String(value).trim() === "") return "missing";
  const v = String(value).trim().toLowerCase();
  if (v.startsWith("high")) return "high";
  if (v.startsWith("mod") || v.startsWith("med")) return "moderate";
  if (v === "low" || v === "normal" || v === "norm") return "low";
  return "invalid";
};

/**
 * Returns the highest VALID risk level among a list.
 * Ignores "missing" and "invalid" entries — they don't escalate house risk.
 * Returns "missing" only if the entire list is non-valid.
 */
export const highestRisk = (levels: ClinicalRiskState[]): ClinicalRiskState => {
  const valid = levels.filter(
    (l): l is RiskLevel => l === "low" || l === "moderate" || l === "high",
  );
  if (valid.length === 0) return "missing";
  return valid.reduce<RiskLevel>((acc, l) => (riskOrder[l] > riskOrder[acc] ? l : acc), "low");
};

/* -------------------------------------------------------------------------- */
/*   VITALS AUDIT FUNCTION                                                     */
/*   IMPORTANT: This function is for DISPLAY/AUDIT purposes ONLY.             */
/*   It does NOT determine Clinical Risk.                                      */
/*   Clinical Risk comes exclusively from member_assessments.risk_level.       */
/* -------------------------------------------------------------------------- */

export interface VitalsAuditResult {
  /** Vitals-derived reference level — for audit display only, never used as clinical risk. */
  vitalsReferenceLevel: RiskLevel;
  reasons: string[];
}

/**
 * Evaluates vitals against reference thresholds for DISPLAY purposes.
 * The result is shown in the member profile as "Vitals Reference" only.
 * It NEVER overwrites or substitutes for Clinical Risk.
 */
export function vitalsAuditRisk(
  input: {
    systolic?: number | null;
    diastolic?: number | null;
    bloodSugar?: number | null;
  },
  thresholds?: {
    bp?: {
      high: { systolic: number; diastolic: number };
      moderate: { systolic: number; diastolic: number };
    };
    sugar?: { high: number; moderate: number };
  },
): VitalsAuditResult {
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
      reasons.push(`BP ${systolic ?? "-"}/${diastolic ?? "-"} at or above high reference`);
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
      reasons.push(`Blood sugar ${bloodSugar} at or above high reference`);
    } else if (bloodSugar >= cfg.sugar!.moderate) {
      escalate("moderate");
      reasons.push(`Blood sugar ${bloodSugar} raised`);
    }
  }

  return { vitalsReferenceLevel: level, reasons };
}

/**
 * @deprecated Use vitalsAuditRisk() instead. This alias exists only for
 * backward compatibility with existing components that called calculateRisk().
 * It does NOT determine Clinical Risk — vitals only.
 */
export function calculateRisk(
  input: {
    systolic?: number | null;
    diastolic?: number | null;
    bloodSugar?: number | null;
    conditions?: string[];
  },
  thresholds?: Parameters<typeof vitalsAuditRisk>[1],
): { level: RiskLevel; reasons: string[] } {
  const r = vitalsAuditRisk(input, thresholds);
  return { level: r.vitalsReferenceLevel, reasons: r.reasons };
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
  /**
   * Canonical Clinical Risk — sourced EXCLUSIVELY from member_assessments.risk_level.
   * NEVER derived from BP, BMI, blood sugar, age, or any vital.
   *
   * Values:
   *   "high" | "moderate" | "low"  → valid clinical risk
   *   "missing"                    → risk_level was null/empty in DB
   *   "invalid"                    → risk_level had an unrecognised value
   *
   * "missing" and "invalid" must NOT be displayed as "Low" in the UI.
   * Use riskDisplayLabel() which handles all states correctly.
   */
  risk: ClinicalRiskState;
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
  // thresholds kept for API compatibility — used only for vitals audit display, NOT risk classification
  _thresholds?: Parameters<typeof vitalsAuditRisk>[1],
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

  // ── CANONICAL CLINICAL RISK RESOLUTION ───────────────────────────────────────
  // SOURCE: house_members.data.clinical_risk ONLY.
  // NEVER derived from BP / BMI / blood sugar / age / conditions / vitals / Life Risk.
  //
  // If the DB field is missing or invalid, we preserve that state exactly.
  // We do NOT silently substitute "low" — that would falsify Dashboard/Analytics counts.
  const rawRisk = data["clinical_risk"]; // Do NOT fallback to assessment?.risk_level
  const risk: ClinicalRiskState = rawRisk ? asRisk(String(rawRisk)) : "missing";
  // ─────────────────────────────────────────────────────────────────────────────

  // riskReasons is for human-readable audit trail, not for risk determination
  const riskReasons: string[] =
    risk === "missing"
      ? ["Clinical Risk not recorded in database"]
      : risk === "invalid"
        ? [`Unrecognised risk value in database: "${rawRisk}"`]
        : [`Clinical Risk from record: ${risk}`];

  // ── ELIGIBILITY ──────────────────────────────────────────────────────────────
  // Priority 1: Check imported Excel "Eligible (≥30)" field (explicit override).
  // Eligibility is independent of Clinical Risk.
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

  // Check multiple possible field name formats from Excel
  let eligible = isEligibleMember({ data });

  // ── DATA QUALITY FLAGS ───────────────────────────────────────────────────────
  const dataIssues: string[] = [];
  if (!member.member_name) dataIssues.push("Missing name");
  if (age == null) dataIssues.push("Missing age");
  if (!gender) dataIssues.push("Missing gender");
  if (systolic == null || diastolic == null) dataIssues.push("Missing BP");
  if (bloodSugar == null) dataIssues.push("Missing sugar");
  if (risk === "missing") dataIssues.push("Clinical Risk not recorded");
  if (risk === "invalid") dataIssues.push("Invalid Clinical Risk value");
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
    riskReasons,
    eligible,
    screenedAt: assessment?.assessed_at ?? null,
    assessment,
    extraFields,
    dataIssues,
  };
}

export interface HouseView {
  house: House;
  members: MemberView[];
  /** Highest valid clinical risk among members. "missing" if all members lack clinical risk. */
  risk: ClinicalRiskState;
  /** Counts of members per valid clinical risk level (excludes missing/invalid). */
  counts: Record<RiskLevel, number> & { missing: number; invalid: number };
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
  const counts: Record<RiskLevel, number> & { missing: number; invalid: number } = {
    low: 0,
    moderate: 0,
    high: 0,
    missing: 0,
    invalid: 0,
  };
  members.forEach((m) => {
    if (m.risk === "low" || m.risk === "moderate" || m.risk === "high") {
      counts[m.risk] += 1;
    } else if (m.risk === "missing") {
      counts.missing += 1;
    } else {
      counts.invalid += 1;
    }
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
  risk: ClinicalRiskState;
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

/**
 * The ONLY canonical eligibility resolver.
 * "Eligible (≥30)" from Excel is the only source.
 * Age >= 30 is NEVER used to silently calculate eligibility.
 */
export function isEligibleMember(member: {
  eligible?: boolean;
  data?: Record<string, any> | null;
}): boolean {
  if (member.eligible !== undefined) return member.eligible;

  const memberData = member.data ?? {};
  const eligibleRaw =
    memberData["eligible"] ?? memberData["Eligible (≥30)"] ?? memberData["eligible_30"];
  if (eligibleRaw != null && String(eligibleRaw).trim() !== "") {
    return String(eligibleRaw).trim().toLowerCase() === "yes";
  }
  
  return false;
}
