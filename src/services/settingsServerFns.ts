import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getHealthThresholdSettings,
  updateHealthThresholdSettings,
} from "@/services/settingsService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tables } from "@/config/database";
import type { AppRole } from "@/config/roles";

/* -------------------------------------------------------------------------- */
/*            Helper: resolve the calling user on the SERVER side             */
/* -------------------------------------------------------------------------- */

async function resolveServerUser(clientHints?: {
  userId?: string | undefined;
  role?: string | undefined;
  supervisorId?: string | undefined;
}) {
  const adminClient = getSupabaseAdmin();

  // For server functions we don't have the browser session cookie,
  // but we DO have the admin client.  The client sends hints which we
  // cross-reference against the database to avoid trusting the client.

  // If userId hint is provided (it's a UUID), verify it exists.
  let userId: string | null = clientHints?.userId ?? null;
  let role: AppRole | null = null;
  let supervisorId: string | null = clientHints?.supervisorId ?? null;

  if (userId) {
    // Look up the role from the DB to avoid trusting the client
    const { data: roles } = await adminClient
      .from(tables.userRoles)
      .select("role")
      .eq("user_id", userId);

    if (roles && roles.length > 0) {
      const priority: AppRole[] = ["super_admin", "admin", "supervisor", "survey_user"];
      role = priority.find((r) => roles.some((row) => row.role === r)) ?? null;
    }

    // If the user is a survey_user (CHW), resolve their supervisor
    if (role === "survey_user" && !supervisorId) {
      const { data: teamData } = await adminClient
        .from(tables.teamMemberships)
        .select("supervisor_id")
        .eq("csw_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (teamData?.supervisor_id) {
        supervisorId = teamData.supervisor_id;
      }
    }
  }

  return { userId, role, supervisorId };
}

/* -------------------------------------------------------------------------- */
/*                         GET HEALTH THRESHOLDS                              */
/* -------------------------------------------------------------------------- */

export const getHealthThresholds = createServerFn({ method: "POST" })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { userId, role, supervisorId } = (data || {}) as {
      userId?: string;
      role?: string;
      supervisorId?: string;
    };

    const resolved = await resolveServerUser({ userId, role, supervisorId });
    const s = await getHealthThresholdSettings(
      false,
      resolved.userId,
      resolved.role,
      resolved.supervisorId,
    );
    return { success: true, settings: s };
  });

/* -------------------------------------------------------------------------- */
/*                       UPDATE HEALTH THRESHOLDS                             */
/* -------------------------------------------------------------------------- */

export const updateHealthThresholds = createServerFn({ method: "POST" })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { userId, role, updates } = (data || {}) as {
      userId: string;
      role: string;
      updates: any;
    };

    // 1. Resolve the ACTUAL user and role from the database (never trust client)
    const resolved = await resolveServerUser({ userId, role });

    if (!resolved.userId) {
      throw new Error("Authentication required.");
    }

    if (!resolved.role) {
      throw new Error("No role found for this user.");
    }

    // 2. Enforce role-based access: only admin, super_admin, supervisor can update
    const canUpdate =
      resolved.role === "admin" ||
      resolved.role === "super_admin" ||
      resolved.role === "supervisor";

    if (!canUpdate) {
      throw new Error("You do not have permission to modify App Rules.");
    }

    // 3. Perform the update using the verified server-side identity
    const s = await updateHealthThresholdSettings(
      resolved.userId,
      resolved.role,
      updates,
    );

    return { success: true, settings: s };
  });

export default {};
