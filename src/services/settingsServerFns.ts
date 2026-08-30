import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getHealthThresholdSettings,
  updateHealthThresholdSettings,
} from "@/services/settingsService";

export const getHealthThresholds = createServerFn({ method: "POST" })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { userId, role, supervisorId } = (data || {}) as {
      userId?: string;
      role?: string;
      supervisorId?: string;
    };
    const s = await getHealthThresholdSettings(false, userId, role, supervisorId);
    return { success: true, settings: s };
  });

export const putHealthThresholds = createServerFn({ method: "POST" })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    // data must include changedBy (user id) and updates (partial settings)
    const { changedBy, role, updates } = data as {
      changedBy?: string | null;
      role?: string | null;
      updates: Record<string, any>;
    };
    // Basic validation will be applied in updateHealthThresholdSettings
    const res = await updateHealthThresholdSettings(changedBy ?? null, role ?? null, updates);
    return { success: true, result: res };
  });

export default {};
