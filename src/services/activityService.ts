import { tables } from "@/config/database";
import { supabase } from "@/db/client";
import type { ActivityLog, Json } from "@/db/types";

/** Best-effort audit trail; never blocks or breaks the user's action. */
export async function logActivity(action: string, details?: Record<string, Json>) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from(tables.activityLogs).insert({
      user_id: auth.user.id,
      username: auth.user.email?.split("@")[0] ?? null,
      action,
      details: (details ?? null) as Json,
    });
  } catch (error) {
    console.warn("activity log skipped", error);
  }
}

export async function loadActivity(limit = 100) {
  const { data, error } = await supabase
    .from(tables.activityLogs)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}
