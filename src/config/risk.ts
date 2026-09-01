/**
 * Risk configuration. Values are thresholds only — exact readings are ALWAYS
 * preserved and displayed alongside the derived category.
 */
export type RiskLevel = "normal" | "moderate" | "high";

export const riskConfig = {
  bp: {
    high: { systolic: 140, diastolic: 90 },
    moderate: { systolic: 130, diastolic: 80 },
  },
  sugar: {
    high: 200,
    moderate: 140,
  },
  /** A member with this many known conditions is escalated one level. */
  multipleConditionsThreshold: 2,
} as const;

export const riskOrder: Record<RiskLevel, number> = { normal: 0, moderate: 1, high: 2 };

/**
 * User-facing risk labels. Internally we use "low" for backward-compat
 * with existing database records, but the UI always displays "Normal".
 */
export const riskLabels: Record<RiskLevel, string> = {
  normal: "Normal",
  moderate: "Moderate",
  high: "High",
};

/**
 * Returns the user-facing display label for a risk level.
 * Always use this instead of hard-coding label strings.
 */
export function riskDisplayLabel(risk: RiskLevel | string | null | undefined): string {
  const r = (risk ?? "normal").toLowerCase();
  if (r.startsWith("high")) return riskLabels.high;
  if (r.startsWith("mod") || r.startsWith("med")) return riskLabels.moderate;
  return riskLabels.normal;
}

/** Priority score weights — used for follow-up ordering, never to hide readings. */
export const priorityWeights = {
  highRisk: 50,
  moderateRisk: 25,
  overdueFollowUpPerDay: 2,
  multipleConditions: 15,
  missingCondition: 8,
  dataQualityIssue: 5,
} as const;
