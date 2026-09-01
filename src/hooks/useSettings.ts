import { create } from "zustand";
import { followUpConfig } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import { tables } from "@/config/database";
import { getHealthThresholdSettings } from "@/services/settingsService";

interface SettingsState {
  followUpIntervals: Record<RiskLevel, number>;
  dailyTarget: number;
  minEligibleAge: number;
  thresholds: any | null; // You can type this better later if needed
  updateDailyTarget: (target: number) => Promise<void>;
  loadSettings: (userId?: string, role?: string, supervisorId?: string) => Promise<void>;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  followUpIntervals: { ...followUpConfig.intervalDays },
  dailyTarget: followUpConfig.defaultDailyTarget,
  minEligibleAge: 30, // Default fallback
  thresholds: null,

  loadSettings: async (userId?: string, role?: string, supervisorId?: string) => {
    try {
      // 1. Load basic UI settings (dailyTarget) from activityLogs (legacy behavior for non-threshold settings if needed)
      const { data: activityData } = await supabase
        .from(tables.activityLogs)
        .select("details")
        .eq("action", "system.settings.update")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (typeof activityData?.details?.dailyTarget === "number") {
        set({ dailyTarget: activityData.details.dailyTarget });
      }

      // 2. Load health thresholds and intervals from the backend table
      const s = await getHealthThresholdSettings(false, userId, role, supervisorId, supabase);
      if (s) {
        set({
          minEligibleAge: s.minimum_eligible_age ?? 30,
          followUpIntervals: {
            high: s.interval_high ?? followUpConfig.intervalDays.high,
            moderate: s.interval_moderate ?? followUpConfig.intervalDays.moderate,
            // "low" is the internal key (Excel: LOW, DB: low, UI: Normal)
            low: s.interval_normal ?? followUpConfig.intervalDays.low,
          },
          thresholds: {
            ...s,
            vitals_config: s.vitals_config ?? {
              bloodPressure: true,
              bloodSugar: true,
              weight: true,
              height: true,
              bmi: true,
              pulse: true,
              spo2: true,
              temperature: true,
            },
          },
        });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  },

  updateDailyTarget: async (target: number) => {
    const prev = get().dailyTarget;
    set({ dailyTarget: target });
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      const currentDetails = {
        dailyTarget: target,
      };

      const { error } = await supabase.from(tables.activityLogs).insert({
        action: "system.settings.update",
        details: currentDetails,
        user_id: userId,
      });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to save daily target to backend:", e);
      set({ dailyTarget: prev });
      throw e;
    }
  },
}));
