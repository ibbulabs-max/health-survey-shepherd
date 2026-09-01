/**
 * Risk configuration. Values are thresholds only — exact readings are ALWAYS
 * preserved and displayed alongside the derived category.
 *
 * IMPORTANT: Internal/backend risk values are "low" | "moderate" | "high"
 * These match the Excel source data (LOW/MODERATE/HIGH).
 * UI display: low → "Normal", moderate → "Moderate", high → "High"
 * DO NOT rename the internal "low" value to "normal".
 */
export type RiskLevel = "low" | "moderate" | "high";

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

export const riskOrder: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 };

/**
 * User-facing risk labels.
 * Internal DB/backend value "low" is displayed as "Normal" to users.
 * Excel values LOW/MODERATE/HIGH map to low/moderate/high internally.
 */
export const riskLabels: Record<RiskLevel, string> = {
  low: "Normal",
  moderate: "Moderate",
  high: "High",
};

/**
 * Returns the user-facing display label for a risk level.
 * Always use this instead of hard-coding label strings.
 * low → "Normal", moderate → "Moderate", high → "High"
 */
export function riskDisplayLabel(risk: RiskLevel | string | null | undefined): string {
  const r = (risk ?? "low").toLowerCase();
  if (r.startsWith("high")) return riskLabels.high;
  if (r.startsWith("mod") || r.startsWith("med")) return riskLabels.moderate;
  // "low", "normal", "norm", "" → Normal
  return riskLabels.low;
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
