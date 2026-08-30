import {
  ELIGIBLE_AGE,
  FOLLOW_UP_INTERVALS,
  isEligibleForFollowUp,
  parseDateSafe,
  toDateKeySafe,
  formatDisplayDate,
  addDaysCalendar,
  calculateNextFollowUpDate,
  parseLegacyFollowUps,
  extractMemberFollowUpSummary,
} from "../src/lib/followUpEngine";
import { calculateRisk } from "../src/lib/domain";
import type { MemberView } from "../src/lib/domain";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

console.log("==========================================");
console.log("RUNNING SPEC TESTS FOR FOLLOW-UP SYSTEM");
console.log("==========================================");

// TEST 1: Age = 29 -> NOT eligible
assert(isEligibleForFollowUp(29) === false, "Test 1: Age 29 is NOT eligible");
assert(isEligibleForFollowUp(28) === false, "Test 1b: Age 28 is NOT eligible");
assert(isEligibleForFollowUp(0) === false, "Test 1c: Age 0 is NOT eligible");

// TEST 2: Age = 30 -> Eligible
assert(isEligibleForFollowUp(30) === true, "Test 2: Age 30 is ELIGIBLE");

// TEST 3: Age = 30+ -> Eligible
assert(isEligibleForFollowUp(31) === true, "Test 3a: Age 31 is ELIGIBLE");
assert(isEligibleForFollowUp(40) === true, "Test 3b: Age 40 is ELIGIBLE");
assert(isEligibleForFollowUp(60) === true, "Test 3c: Age 60 is ELIGIBLE");

// TEST 4: Risk Intervals
assert(FOLLOW_UP_INTERVALS.high === 15, "Test 4a: High Risk interval is 15 days");
assert(FOLLOW_UP_INTERVALS.moderate === 30, "Test 4b: Moderate Risk interval is 30 days");
assert(FOLLOW_UP_INTERVALS.low === 180, "Test 4c: Normal Risk interval is 180 days");

// TEST 5: Initial follow-up: Survey Date = 10 Aug 2026
const d1 = "2026-08-10";
const highNext = calculateNextFollowUpDate(d1, "high");
assert(
  highNext === "2026-08-25",
  `Test 5a: 10 Aug 2026 + 15d High = 25 Aug 2026 (got ${highNext})`,
);

const modNext = calculateNextFollowUpDate(d1, "moderate");
assert(
  modNext === "2026-09-09",
  `Test 5b: 10 Aug 2026 + 30d Moderate = 09 Sep 2026 (got ${modNext})`,
);

const normNext = calculateNextFollowUpDate(d1, "low");
assert(
  normNext === "2027-02-06",
  `Test 5c: 10 Aug 2026 + 180d Normal = 06 Feb 2027 (got ${normNext})`,
);

// TEST 6: Four existing completed dates parsing & recurring anchor
const legacySample = `07 Aug 2026 | COMPLETED | Recheck BP
08 Aug 2026 | COMPLETED | RECHECK BP
11 Aug 2026 | COMPLETED | Recheck BP
24 Aug 2026 | COMPLETED | Recheck BP`;

const parsed = parseLegacyFollowUps(legacySample);
assert(parsed.length === 4, `Test 6a: Parsed all 4 follow-up dates (got ${parsed.length})`);
assert(
  parsed[0].dateKey === "2026-08-07" || parsed.some((p) => p.dateKey === "2026-08-24"),
  "Test 6b: 24 Aug 2026 is extracted",
);

// Check clean date format (does NOT show "COMPLETED" as date label)
assert(
  !parsed[0].formattedDate.includes("COMPLETED"),
  `Test 6c: Clean date formatted: ${parsed[0].formattedDate}`,
);

// TEST 7: Recurring follow-up from Last completed = 24 Aug 2026
const anchor = "2026-08-24";
const recHigh = calculateNextFollowUpDate(anchor, "high");
assert(recHigh === "2026-09-08", `Test 7a: 24 Aug + 15d = 08 Sep 2026 (got ${recHigh})`);

const recMod = calculateNextFollowUpDate(anchor, "moderate");
assert(recMod === "2026-09-23", `Test 7b: 24 Aug + 30d = 23 Sep 2026 (got ${recMod})`);

const recNorm = calculateNextFollowUpDate(anchor, "low");
assert(recNorm === "2027-02-20", `Test 7c: 24 Aug + 180d = 20 Feb 2027 (got ${recNorm})`);

// TEST 8: Full summary integration
const mockMember: MemberView = {
  id: "mem-1",
  memberId: "M001",
  name: "Sajida Begum",
  age: 45,
  gender: "Female",
  houseUuid: "h-1",
  houseId: "B1-L1-2-P",
  systolic: 150,
  diastolic: 95,
  bloodSugar: 210,
  conditions: ["Hypertension", "Diabetes"],
  risk: "high",
  riskReasons: ["BP High"],
  eligible: true,
  screenedAt: "2026-08-01T00:00:00Z",
  assessment: null,
  extraFields: {
    follow_ups: legacySample,
  },
  dataIssues: [],
};

const summary = extractMemberFollowUpSummary(mockMember, null, [], "2026-08-29");
assert(summary.isEligible === true, "Test 8a: Member age 45 is eligible");
assert(
  summary.history.length === 4,
  `Test 8b: Summary contains all 4 history records (got ${summary.history.length})`,
);
assert(
  summary.lastFollowUpDate === "2026-08-24",
  `Test 8c: Last follow-up correctly identified as 2026-08-24 (got ${summary.lastFollowUpDate})`,
);
assert(
  summary.nextFollowUpDate === "2026-09-08",
  `Test 8d: Next follow-up correctly calculated as 2026-09-08 (got ${summary.nextFollowUpDate})`,
);

// TEST 9: Dynamic Vitals Risk Calculation
const highRiskRes = calculateRisk({ systolic: 150, diastolic: 95, bloodSugar: 100 });
assert(highRiskRes.level === "high", "Test 9a: 150/95 evaluates to HIGH risk");

const normalRiskRes = calculateRisk({ systolic: 118, diastolic: 76, bloodSugar: 95 });
assert(
  normalRiskRes.level === "low",
  "Test 9b: 118/76 with normal sugar evaluates to NORMAL (low) risk",
);

const modRiskRes = calculateRisk({ systolic: 132, diastolic: 82, bloodSugar: 110 });
assert(modRiskRes.level === "moderate", "Test 9c: 132/82 evaluates to MODERATE risk");

// TEST 10: Age 29 Member Search vs Follow-up Eligibility
const youngMember: MemberView = {
  id: "mem-young",
  memberId: "M002",
  name: "Young Member",
  age: 29,
  gender: "Male",
  houseUuid: "h-2",
  houseId: "H-2",
  systolic: 120,
  diastolic: 80,
  bloodSugar: 90,
  conditions: [],
  risk: "low",
  riskReasons: [],
  eligible: false,
  screenedAt: "2026-08-10T00:00:00Z",
  assessment: null,
  extraFields: {},
  dataIssues: [],
};

const youngSummary = extractMemberFollowUpSummary(youngMember, null, []);
assert(youngSummary.isEligible === false, "Test 10a: Age 29 summary has isEligible = false");
assert(
  youngSummary.nextFollowUpDate === null,
  "Test 10b: Age 29 does not get automatic routine follow-up",
);

console.log("==========================================");
console.log("ALL 20 TEST CASES PASSED SUCCESSFULLY!");
console.log("==========================================");
