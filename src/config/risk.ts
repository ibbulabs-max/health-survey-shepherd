/**
 * Risk configuration.
 *
 * IMPORTANT ARCHITECTURE RULE:
 *   Clinical Risk comes EXCLUSIVELY from the Excel "Clinical Risk" field /
 *   member_assessments.risk_level in the database.
 *
 *   Clinical Risk is NEVER calculated from:
 *     - Systolic BP        - Diastolic BP
 *     - Blood Sugar        - BMI / Height / Weight
 *     - Age                - Conditions
 *     - Life Risk          - Lifestyle Risk
 *     - Vitals thresholds  - Any formula
 *
 *   Internal canonical values:
 *     "high"     ← Excel: High / HIGH / high
 *     "moderate" ← Excel: Moderate / MODERATE / mod…
 *     "low"      ← Excel: Low / LOW / low / Normal / NORMAL / norm
 *     "missing"  ← null / empty — preserved as-is, NOT converted to "low"
 *     "invalid"  ← unrecognised garbage — preserved as-is, NOT converted to "low"
 *
 *   UI display:
 *     "high"    → "High"
 *     "moderate"→ "Moderate"
 *     "low"     → "Low"
 *     "missing" → "Not Assessed"
 *     "invalid" → "Unknown"
 */
export type RiskLevel = "low" | "moderate" | "high";

/**
 * Full clinical risk state including non-classified states.
 * Consumers that need to handle all states import this type.
 */
export type ClinicalRiskState = RiskLevel | "missing" | "invalid";

export const riskConfig = {
  bp: {
    high: { systolic: 140, diastolic: 90 },
    moderate: { systolic: 130, diastolic: 80 },
  },
  sugar: {
    high: 200,
    moderate: 140,
  },
  /** A member with this many known conditions is flagged in data quality. */
  multipleConditionsThreshold: 2,
} as const;

export const riskOrder: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 };

/**
 * User-facing risk labels for valid clinical risk values.
 * "low"      → "Low"      (Excel "Normal" normalizes to "low" → displays as "Low")
 * "moderate" → "Moderate"
 * "high"     → "High"
 */
export const riskLabels: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/**
 * Returns the user-facing display label for any clinical risk state.
 * Always use this instead of hard-coding label strings.
 *
 * "high"    → "High"
 * "moderate"→ "Moderate"
 * "low"     → "Low"      (this includes Excel "Normal" which normalized to "low")
 * "missing" → "Not Assessed"
 * "invalid" → "Unknown"
 * null/""   → "Not Assessed"
 */
export function riskDisplayLabel(risk: ClinicalRiskState | string | null | undefined): string {
  if (risk == null || risk === "") return "Not Assessed";
  const r = String(risk).trim().toLowerCase();
  if (r === "high") return riskLabels.high;
  if (r === "moderate") return riskLabels.moderate;
  if (r === "low") return riskLabels.low;
  if (r === "missing" || r === "") return "Not Assessed";
  if (r === "invalid") return "Unknown";
  // Fallback for any other string — try to normalize
  if (r.startsWith("high")) return riskLabels.high;
  if (r.startsWith("mod") || r.startsWith("med")) return riskLabels.moderate;
  if (r === "normal" || r === "norm") return riskLabels.low;
  return "Unknown";
}

/** Priority score weights — used for follow-up ordering only. */
export const priorityWeights = {
  highRisk: 50,
  moderateRisk: 25,
  overdueFollowUpPerDay: 2,
  multipleConditions: 15,
  missingCondition: 8,
  dataQualityIssue: 5,
} as const;
