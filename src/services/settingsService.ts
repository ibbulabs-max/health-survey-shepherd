import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import { riskConfig } from "@/config/risk";
import { followUpConfig } from "@/config/followups";

export type HealthThresholds = {
  systolic_normal_max: number;
  systolic_moderate_min: number;
  systolic_high_min: number;
  diastolic_normal_max: number;
  diastolic_moderate_min: number;
  diastolic_high_min: number;
  sugar_normal_max: number;
  sugar_moderate_min: number;
  sugar_moderate_max: number;
  sugar_high_min: number;
  interval_high: number;
  interval_moderate: number;
  interval_low: number;
  vitals_config: {
    bloodPressure: boolean;
    bloodSugar: boolean;
    weight: boolean;
    height: boolean;
    bmi: boolean;
    pulse: boolean;
    spo2: boolean;
    temperature: boolean;
  };
  working_days: string[];
  working_hours: { start: string; end: string };
};

export const defaultSettings: HealthThresholds = {
  systolic_normal_max: riskConfig.bp.moderate.systolic - 1,
  systolic_moderate_min: riskConfig.bp.moderate.systolic,
  systolic_high_min: riskConfig.bp.high.systolic,
  diastolic_normal_max: riskConfig.bp.moderate.diastolic - 1,
  diastolic_moderate_min: riskConfig.bp.moderate.diastolic,
  diastolic_high_min: riskConfig.bp.high.diastolic,
  sugar_normal_max: riskConfig.sugar.moderate - 1,
  sugar_moderate_min: riskConfig.sugar.moderate,
  sugar_moderate_max: riskConfig.sugar.high - 1,
  sugar_high_min: riskConfig.sugar.high,
  interval_high: followUpConfig.intervalDays.high,
  interval_moderate: followUpConfig.intervalDays.moderate,
  interval_low: followUpConfig.intervalDays.low,
  vitals_config: {
    bloodPressure: true,
    bloodSugar: true,
    weight: true,
    height: true,
    bmi: true,
    pulse: true,
    spo2: true,
    temperature: true,
  },
  working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  working_hours: { start: "09:00", end: "17:00" },
};

let cached: { value: HealthThresholds | null; expiresAt: number } = { value: null, expiresAt: 0 };
const CACHE_TTL_MS = 30 * 1000;

export async function getHealthThresholdSettings(
  forceRefresh = false,
  userId?: string | null,
  role?: string | null,
  supervisorId?: string | null,
  client?: any,
): Promise<HealthThresholds> {
  const now = Date.now();
  if (!forceRefresh && cached.value && cached.expiresAt > now) {
    return cached.value;
  }

  const dbClient = client || getSupabaseAdmin();

  let targetSupervisorId = role === "supervisor" ? userId : supervisorId;

  if (role === "survey_user" && userId && !targetSupervisorId) {
    const { data: teamData } = await dbClient
      .from(tables.teamMemberships)
      .select("supervisor_id")
      .eq("csw_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (teamData?.supervisor_id) {
      targetSupervisorId = teamData.supervisor_id;
    }
  }

  // Fetch both Global Admin config (supervisor_id is null)
  // AND Supervisor Override (supervisor_id = targetSupervisorId) in one go
  let query = dbClient.from(tables.healthThresholdSettings).select("*");

  if (targetSupervisorId) {
    query = query.or(`supervisor_id.is.null,supervisor_id.eq.${targetSupervisorId}`);
  } else {
    query = query.is("supervisor_id", null);
  }

  // order by supervisor_id NULLS FIRST so that the supervisor override is the LAST element, overwriting the admin default
  const { data, error } = await query.order("supervisor_id", { ascending: true, nullsFirst: true });

  if (error && error.code !== "PGRST116") {
    console.warn("Could not fetch settings from database, returning defaults", error);
  }

  let dbSettings: Partial<HealthThresholds> = {};

  if (data && data.length > 0) {
    for (const row of data) {
      dbSettings = {
        ...dbSettings,
        ...row,
        // Ensure jsonb is properly parsed if needed
        vitals_config:
          typeof row.vitals_config === "string" ? JSON.parse(row.vitals_config) : row.vitals_config,
        working_days:
          typeof row.working_days === "string" ? JSON.parse(row.working_days) : row.working_days,
        working_hours:
          typeof row.working_hours === "string" ? JSON.parse(row.working_hours) : row.working_hours,
      };
    }
  }

  const value = { ...defaultSettings, ...dbSettings } as HealthThresholds;
  cached = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export async function updateHealthThresholdSettings(
  changedBy: string | null,
  role: string | null,
  updates: Partial<HealthThresholds>,
  client?: any,
) {
  const prev = await getHealthThresholdSettings(true, changedBy, role, null, client);
  const next = { ...prev, ...updates } as HealthThresholds;

  if (next.systolic_normal_max >= next.systolic_moderate_min) {
    throw new Error(
      "Invalid systolic thresholds: systolic_normal_max must be < systolic_moderate_min",
    );
  }
  if (next.systolic_moderate_min > next.systolic_high_min) {
    throw new Error(
      "Invalid systolic thresholds: systolic_moderate_min must be <= systolic_high_min",
    );
  }
  if (next.diastolic_normal_max >= next.diastolic_moderate_min) {
    throw new Error(
      "Invalid diastolic thresholds: diastolic_normal_max must be < diastolic_moderate_min",
    );
  }
  if (next.diastolic_moderate_min > next.diastolic_high_min) {
    throw new Error(
      "Invalid diastolic thresholds: diastolic_moderate_min must be <= diastolic_high_min",
    );
  }
  if (next.sugar_normal_max >= next.sugar_moderate_min) {
    throw new Error("Invalid sugar thresholds: sugar_normal_max must be < sugar_moderate_min");
  }
  if (next.sugar_moderate_min > next.sugar_moderate_max) {
    throw new Error("Invalid sugar thresholds: sugar_moderate_min must be <= sugar_moderate_max");
  }
  if (next.sugar_moderate_max >= next.sugar_high_min) {
    throw new Error("Invalid sugar thresholds: sugar_moderate_max must be < sugar_high_min");
  }
  if (next.interval_high <= 0 || next.interval_moderate <= 0 || next.interval_low <= 0) {
    throw new Error("Intervals must be greater than 0");
  }

  const dbClient = client || getSupabaseAdmin();
  const targetSupervisorId = role === "supervisor" ? changedBy : null;

  // Explicitly check for existing row due to lack of strict UNIQUE CONSTRAINT
  let query = dbClient.from(tables.healthThresholdSettings).select("id");
  if (targetSupervisorId) {
    query = query.eq("supervisor_id", targetSupervisorId);
  } else {
    query = query.is("supervisor_id", null);
  }

  const { data: existingRow, error: selectError } = await query.maybeSingle();
  if (selectError && selectError.code !== "PGRST116") {
    throw selectError;
  }

  const payload = {
    systolic_normal_max: next.systolic_normal_max,
    systolic_moderate_min: next.systolic_moderate_min,
    systolic_high_min: next.systolic_high_min,
    diastolic_normal_max: next.diastolic_normal_max,
    diastolic_moderate_min: next.diastolic_moderate_min,
    diastolic_high_min: next.diastolic_high_min,
    sugar_normal_max: next.sugar_normal_max,
    sugar_moderate_min: next.sugar_moderate_min,
    sugar_moderate_max: next.sugar_moderate_max,
    sugar_high_min: next.sugar_high_min,
    interval_high: next.interval_high,
    interval_moderate: next.interval_moderate,
    interval_low: next.interval_low,
    vitals_config: next.vitals_config,
    working_days: next.working_days ?? defaultSettings.working_days,
    working_hours: next.working_hours ?? defaultSettings.working_hours,
    supervisor_id: targetSupervisorId,
    created_by: changedBy,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (existingRow?.id) {
    const res = await dbClient
      .from(tables.healthThresholdSettings)
      .update(payload)
      .eq("id", existingRow.id);
    error = res.error;
  } else {
    const res = await dbClient.from(tables.healthThresholdSettings).insert(payload);
    error = res.error;
  }

  // Write to dedicated audit trail table (preserves old+new values independently of activity_logs)
  try {
    await dbClient.from("health_threshold_settings_audit").insert({
      settings_id: existingRow?.id ?? null,
      changed_by: changedBy,
      previous_values: prev,
      new_values: next,
    });
  } catch (auditErr) {
    // Non-fatal: don't block settings save if audit insert fails
    console.warn("Could not write settings audit log:", auditErr);
  }

  // Also keep an activity log entry
  await dbClient.from(tables.activityLogs).insert({
    action: role === "supervisor" ? "system.settings.update.team" : "system.settings.update",
    user_id: changedBy,
    details: { thresholds: next },
  });

  if (error) throw error;

  await getHealthThresholdSettings(true, changedBy, role, null, client);
  return next;
}
