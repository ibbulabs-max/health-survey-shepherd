import { buildMemberView } from "../src/lib/domain";
import { isEligibleForFollowUp } from "../src/lib/followUpEngine";
import { getRiskInterval } from "../src/services/followUpService";
import type { HouseMember, MemberAssessment } from "../src/db/types";

async function runTests() {
  console.log("=========================================");
  console.log("SAFE BUSINESS LOGIC VERIFICATION REPORT");
  console.log("=========================================\n");

  const runCase = (
    name: string,
    data: Record<string, any>,
    assessment: MemberAssessment | null = null,
  ) => {
    const member: HouseMember = {
      id: "mock-id",
      house_uuid: "mock-house",
      member_id: "M001",
      member_name: "Test User",
      data,
      source_files: [],
      uploaded_by: "system",
      uploaded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      possible_duplicate: false,
    };

    const view = buildMemberView(member, assessment);

    console.log(`[TEST] ${name}`);
    console.log(`  Input DB 'data'       : ${JSON.stringify(data)}`);
    if (assessment) {
      console.log(
        `  Input DB 'assessment' : ${JSON.stringify({ risk_level: assessment.risk_level })}`,
      );
    }
    console.log(`  => Output UI 'risk'   : ${view.risk}`);
    console.log(`  => Output 'eligible'  : ${view.eligible}`);
    if (view.risk === "low" || view.risk === "moderate" || view.risk === "high") {
      console.log(`  => Interval (days)    : ${getRiskInterval(view.risk)}`);
    }
    console.log("-----------------------------------------");
  };

  // Case A: LOW
  runCase("Case A: Excel Clinical Risk = LOW", { clinical_risk: "low", eligible: "Yes" });

  // Case B: MODERATE
  runCase("Case B: Excel Clinical Risk = MODERATE", { clinical_risk: "moderate", eligible: "Yes" });

  // Case C: HIGH
  runCase("Case C: Excel Clinical Risk = HIGH", { clinical_risk: "high", eligible: "Yes" });

  // Case D: MISSING
  runCase("Case D: Clinical Risk Missing", { eligible: "Yes" });

  // Case E: INVALID
  runCase("Case E: Invalid Clinical Risk", { clinical_risk: "invalid", eligible: "Yes" });

  // Case F/G: Eligibility
  runCase("Case F: Eligible = Yes", { clinical_risk: "high", eligible: "Yes" });
  runCase("Case G: Eligible = No", { clinical_risk: "high", eligible: "No" });

  // Case K/L: Override via assessment
  runCase(
    "Case K: Override (Assessment says low, Data says high)",
    { clinical_risk: "high", eligible: "Yes" },
    { risk_level: "low" } as any,
  );
  runCase(
    "Case L: Override (Assessment says moderate, Data says low)",
    { clinical_risk: "low", eligible: "Yes" },
    { risk_level: "moderate" } as any,
  );

  console.log("Verification Complete.");
}

runTests().catch(console.error);
