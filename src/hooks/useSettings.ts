import { create } from "zustand";
import { followUpConfig } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import { tables } from "@/config/database";
import { getHealthThresholdSettings } from "@/services/settingsService";

interface SettingsState {
  followUpIntervals: Record<RiskLevel, number>;
  dailyTarget: number;
  thresholds: any | null; // You can type this better later if needed
  globalSettings: any | null;
  updateDailyTarget: (target: number) => Promise<void>;
  updateGlobalSettings: (updates: Partial<any>) => Promise<void>;
  loadSettings: (userId?: string, role?: string, supervisorId?: string) => Promise<void>;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  followUpIntervals: { ...followUpConfig.intervalDays },
  dailyTarget: followUpConfig.defaultDailyTarget,
  thresholds: null,
  globalSettings: null,

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
          followUpIntervals: {
            high: s.interval_high ?? followUpConfig.intervalDays.high,
            moderate: s.interval_moderate ?? followUpConfig.intervalDays.moderate,
            // "low" is the internal key (Excel: LOW, DB: low, UI: Normal)
            low: s.interval_low ?? followUpConfig.intervalDays.low,
          },
          thresholds: s,
        });
      }
      // 3. Load global settings
      const { data: globalData } = await supabase
        .from("global_settings")
        .select("*")
        .eq("singleton_key", true)
        .maybeSingle()
        .then(res => res, () => ({ data: null }));
        
      if (globalData) {
        set({ globalSettings: globalData });
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
  updateGlobalSettings: async (updates: Partial<any>) => {
    const prev = get().globalSettings;
    set({ globalSettings: { ...prev, ...updates } });
    try {
      const { error } = await supabase
        .from("global_settings")
        .update(updates)
        .eq("singleton_key", true);
      if (error) throw error;
    } catch (e) {
      console.error("Failed to save global settings:", e);
      set({ globalSettings: prev });
      throw e;
    }
  },
}));
