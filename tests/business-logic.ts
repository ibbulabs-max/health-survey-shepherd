import assert from "assert";
import {
  calculateNextWorkingDay,
  extractMemberFollowUpSummary,
} from "../src/lib/followUpEngine.ts";
import { Member, FollowUpAssessment, FollowUp } from "../src/types/domain.ts";
import { parseISO, format } from "date-fns";

// Mock holidays
const MOCK_HOLIDAYS = [
  "2026-08-31", // Monday
  "2026-09-01", // Tuesday
];

// 1. Scheduling Rules Validation
console.log("TEST: Scheduling Rules - Sunday skip");
// 2026-08-30 is a Sunday
const nextDayFromSunday = calculateNextWorkingDay(parseISO("2026-08-30"), new Set(MOCK_HOLIDAYS));
// Expected: Should skip Sunday (08-30), Monday (08-31 - holiday), Tuesday (09-01 - holiday) -> Wednesday (09-02)
assert.strictEqual(
  format(nextDayFromSunday, "yyyy-MM-dd"),
  "2026-09-02",
  `Expected 2026-09-02, got ${format(nextDayFromSunday, "yyyy-MM-dd")}`,
);

console.log("TEST: Scheduling Rules - Consecutive Holidays skip");
// 2026-08-31 is Monday (holiday), next is Tuesday (holiday), so next working day is Wednesday (09-02)
const nextDayFromMonday = calculateNextWorkingDay(parseISO("2026-08-31"), new Set(MOCK_HOLIDAYS));
assert.strictEqual(
  format(nextDayFromMonday, "yyyy-MM-dd"),
  "2026-09-02",
  `Expected 2026-09-02, got ${format(nextDayFromMonday, "yyyy-MM-dd")}`,
);

// 2. Risk Engine & Follow-up Extraction Validation
console.log("TEST: Follow-up Engine - Not Eligible by Age");
const underageMember = {
  id: "u1",
  age: 25,
  systolic: 160, // High risk BP, but underage
  diastolic: 100,
  bloodSugar: 100,
} as unknown as Member;

const summaryUnderage = extractMemberFollowUpSummary(underageMember, undefined, [], 30, {
  high: 2,
  moderate: 4,
  low: 180,
});
assert.strictEqual(summaryUnderage.isEligible, false);

console.log("TEST: Follow-up Engine - High Risk Scheduling");
const highRiskMember = {
  id: "h1",
  age: 40,
  risk: "high",
  systolic: 160, // High risk
  diastolic: 100,
  bloodSugar: 100,
} as unknown as Member;

// Mock assessment with survey date
const assessment = {
  assessed_at: "2026-08-01T12:00:00Z", // Survey Date
} as unknown as FollowUpAssessment;

const summaryHighRisk = extractMemberFollowUpSummary(highRiskMember, assessment, [], 30, {
  high: 2,
  moderate: 4,
  low: 180,
});
assert.strictEqual(summaryHighRisk.isEligible, true);
assert.strictEqual(summaryHighRisk.surveyDate, "2026-08-01");
// High risk is +2 days. 08-01 is a Saturday. +2 days is 08-03 (Monday).
assert.strictEqual(summaryHighRisk.nextFollowUpDate, "2026-08-03");

console.log("TEST: Follow-up Engine - Completed Status");
const completedFollowUp = {
  id: "f1",
  member_uuid: "h1",
  status: "completed",
  due_date: "2026-08-04",
} as unknown as FollowUp;

const summaryCompleted = extractMemberFollowUpSummary(
  highRiskMember,
  assessment,
  [completedFollowUp],
  30,
  { high: 2, moderate: 4, low: 180 },
);
assert.strictEqual(summaryCompleted.status, "completed");

console.log("All business logic unit tests passed!");
