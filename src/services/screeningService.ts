import { tables } from "@/config/database";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import type { Json, MemberAssessment } from "@/db/types";
import { calculateRisk } from "@/lib/domain";
import { logActivity } from "@/services/activityService";
import { scheduleFollowUp } from "@/services/followUpService";
import { loadSessionUser } from "@/services/authService";

export interface ScreeningInput {
  houseUuid: string | null;
  memberUuid: string;
  available: boolean;
  systolic: number | null;
  diastolic: number | null;
  bloodSugar: number | null;
  heightCm: number | null;
  weightKg: number | null;
  waist: string | null;
  knownHistory: string[];
  medication: string[];
  smoking: string | null;
  alcohol: string | null;
  tobacco: string | null;
  physicalActivity: string | null;
  notes: string | null;
  referralNeeded: boolean;
  surveyDate?: string | null;
  extra?: Record<string, Json>;
}

const bmiCategory = (bmi: number) => {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
};

export async function saveScreening(input: ScreeningInput) {
  const { data: auth } = await supabase.auth.getUser();
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "survey_user") {
    throw new Error("Unauthorized: Only CHW (Survey Users) can save assessments.");
  }

  const risk = calculateRisk(
    {
      systolic: input.systolic,
      diastolic: input.diastolic,
      bloodSugar: input.bloodSugar,
      conditions: input.knownHistory,
    },
    // Server-side: prefer DB-configured thresholds
    await (async () => {
      try {
        const { getHealthThresholdSettings } = await import("@/services/settingsService");
        const s = await getHealthThresholdSettings();
        return {
          bp: {
            high: { systolic: s.systolic_high_min, diastolic: s.diastolic_high_min },
            moderate: { systolic: s.systolic_moderate_min, diastolic: s.diastolic_moderate_min },
          },
          sugar: { high: s.sugar_high_min, moderate: s.sugar_moderate_min },
        };
      } catch (e) {
        return undefined;
      }
    })(),
  );

  const bmi =
    input.heightCm && input.weightKg
      ? Number((input.weightKg / (input.heightCm / 100) ** 2).toFixed(1))
      : null;

  const payload = {
    house_uuid: input.houseUuid,
    member_uuid: input.memberUuid,
    available: input.available,
    systolic: input.systolic,
    diastolic: input.diastolic,
    blood_sugar: input.bloodSugar,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    bmi,
    bmi_category: bmi ? bmiCategory(bmi) : null,
    waist: input.waist,
    known_history: input.knownHistory as unknown as Json,
    medication: input.medication as unknown as Json,
    smoking: input.smoking,
    alcohol: input.alcohol,
    tobacco: input.tobacco,
    physical_activity: input.physicalActivity,
    notes: input.notes,
    referral_needed: input.referralNeeded,
    risk_level: risk.level,
    risk_reasons: risk.reasons as unknown as Json,
    extra: (input.extra ?? {}) as Json,
    assessed_by: auth.user?.id ?? null,
    assessed_at: input.surveyDate
      ? new Date(input.surveyDate).toISOString()
      : new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(tables.memberAssessments)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;

  await logActivity("screening.saved", { member_uuid: input.memberUuid, risk: risk.level });

  // Auto-close any pending follow-ups for this member
  // Mark existing pending follow-ups as completed and record the assessment time
  const completionIso = input.surveyDate
    ? new Date(input.surveyDate).toISOString()
    : new Date().toISOString();
  await supabase
    .from(tables.followUps)
    .update({
      status: "completed",
      notes: "Automatically completed by new survey",
      updated_at: completionIso,
      completed_at: completionIso,
    })
    .eq("member_uuid", input.memberUuid)
    .eq("status", "pending");

  // Call the centralized follow-up engine to calculate risk and next due date based on eligibility (age >= minEligibleAge)
  const { recalculatePendingFollowUp } = await import("@/services/followUpService");
  await recalculatePendingFollowUp(input.memberUuid);

  return data as MemberAssessment;
}

export async function updateHouseLocation(
  houseUuid: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(tables.houses)
    .update({
      latitude,
      longitude,
      accuracy,
      location_status: "mapped",
      location_source: "device_gps",
      mapped_by: auth.user?.id ?? null,
      mapped_at: new Date().toISOString(),
    })
    .eq("id", houseUuid);
  if (error) throw error;
  await logActivity("house.located", { house_uuid: houseUuid });
}
