import { create } from "zustand";
import { followUpConfig } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import { tables } from "@/config/database";

interface SettingsState {
  followUpIntervals: Record<RiskLevel, number>;
  dailyTarget: number;
  updateInterval: (risk: RiskLevel, days: number) => Promise<void>;
  updateDailyTarget: (target: number) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  followUpIntervals: { ...followUpConfig.intervalDays },
  dailyTarget: followUpConfig.defaultDailyTarget,
  
  loadSettings: async () => {
    try {
      const { data } = await supabase
        .from(tables.activityLogs)
        .select("details")
        .eq("action", "system.settings.update")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.details?.intervals) {
        set({ followUpIntervals: data.details.intervals as Record<RiskLevel, number> });
      }
      if (typeof data?.details?.dailyTarget === 'number') {
        set({ dailyTarget: data.details.dailyTarget });
      }
    } catch (e) {
      console.error("Failed to load settings from backend:", e);
    }
  },

  updateInterval: async (risk, days) => {
    // Optimistic update
    const prev = { ...get().followUpIntervals };
    const next = { ...prev, [risk]: days };
    set({ followUpIntervals: next });

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      
      const { error } = await supabase.from(tables.activityLogs).insert({
        action: "system.settings.update",
        details: { intervals: next },
        user_id: userId
      });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to save settings to backend:", e);
      // Revert on failure
      set({ followUpIntervals: prev });
      throw e;
    }
  },

  updateDailyTarget: async (target: number) => {
    const prev = get().dailyTarget;
    set({ dailyTarget: target });
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      
      const currentDetails = {
        intervals: get().followUpIntervals,
        dailyTarget: target
      };

      const { error } = await supabase.from(tables.activityLogs).insert({
        action: "system.settings.update",
        details: currentDetails,
        user_id: userId
      });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to save daily target to backend:", e);
      set({ dailyTarget: prev });
      throw e;
    }
  }
}));
