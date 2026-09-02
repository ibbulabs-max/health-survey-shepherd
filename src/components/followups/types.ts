import type { RiskLevel, ClinicalRiskState } from "@/config/risk";
import type { MemberView, HouseView } from "@/lib/domain";
import type { MemberFollowUpSummary } from "@/lib/followUpEngine";

export interface EnrichedFollowUpItem {
  id: string;
  member: MemberView | null;
  house: HouseView | null;
  summary: MemberFollowUpSummary;
  assignedChwName: string | null;
  dueDate: string | null;
  displayDueDate: string;
  surveyDate: string | null;
  displaySurveyDate: string;
  status: "today" | "upcoming" | "overdue" | "completed" | "missed" | "not_available";
  risk: ClinicalRiskState;
  vitalsToCheck: ("BP" | "Sugar" | "Weight" | "Pulse")[];
  daysDiffFromToday: number;
}
