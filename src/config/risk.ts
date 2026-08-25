/**
 * Risk configuration. Values are thresholds only — exact readings are ALWAYS
 * preserved and displayed alongside the derived category.
 */
export type RiskLevel = "low" | "moderate" | "high";

export const riskConfig = {
  bp: {
    high: { systolic: 140, diastolic: 90 },
    moderate: { systolic: 130, diastolic: 85 },
  },
  sugar: {
    high: 200,
    moderate: 140,
  },
  /** A member with this many known conditions is escalated one level. */
  multipleConditionsThreshold: 2,
} as const;

export const riskOrder: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 };

export const riskLabels: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/** Priority score weights — used for follow-up ordering, never to hide readings. */
export const priorityWeights = {
  highRisk: 50,
  moderateRisk: 25,
  overdueFollowUpPerDay: 2,
  multipleConditions: 15,
  missingCondition: 8,
  dataQualityIssue: 5,
} as const;
