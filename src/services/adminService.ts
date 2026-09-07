import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { databaseConfig, userIdToAuthEmail } from "@/config/database";
import type { AppRole } from "@/config/roles";

export const createUserAdmin = createServerFn({ method: "POST" })
  .validator(
    (d: { userId: string; pin: string; fullName: string; role: AppRole; supervisorId?: string }) =>
      d,
  )
  .handler(async ({ data: payload }) => {
    const adminClient = getSupabaseAdmin();

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userIdToAuthEmail(payload.userId),
      password: payload.pin,
      email_confirm: true,
      user_metadata: {
        must_change_pin: true,
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Failed to create user in Auth.");
    }

    const newUserId = authData.user.id;

    // 2. Create the profile
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: newUserId,
      username: payload.userId,
      full_name: payload.fullName,
    });

    if (profileError) {
      // Attempt rollback
      await adminClient.auth.admin.deleteUser(newUserId);
      throw new Error(profileError.message);
    }

    // 3. Assign role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: payload.role,
    });

    if (roleError) {
      throw new Error(roleError.message);
    }

    // 4. Team membership for CSW
    if (payload.role === "survey_user" && payload.supervisorId) {
      await adminClient.from("team_memberships").insert({
        supervisor_id: payload.supervisorId,
        csw_id: newUserId,
        status: "active",
      });
    }

    return { success: true, id: newUserId };
  });

export const updateUserRoleAdmin = createServerFn({ method: "POST" })
  .validator((d: { userId: string; role: AppRole }) => d)
  .handler(async ({ data: payload }) => {
    const adminClient = getSupabaseAdmin();
    const { error } = await adminClient
      .from("user_roles")
      .update({ role: payload.role })
      .eq("user_id", payload.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateUserSupervisorAdmin = createServerFn({ method: "POST" })
  .validator((d: { cswId: string; supervisorId: string }) => d)
  .handler(async ({ data: payload }) => {
    const adminClient = getSupabaseAdmin();
    const { data: existing } = await adminClient
      .from("team_memberships")
      .select("*")
      .eq("csw_id", payload.cswId)
      .maybeSingle();

    if (existing) {
      const { error } = await adminClient
        .from("team_memberships")
        .update({ supervisor_id: payload.supervisorId })
        .eq("csw_id", payload.cswId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await adminClient
        .from("team_memberships")
        .insert({ csw_id: payload.cswId, supervisor_id: payload.supervisorId, status: "active" });
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

export const resetUserPinAdmin = createServerFn({ method: "POST" })
  .validator((d: { userId: string; pin: string }) => d)
  .handler(async ({ data: payload }) => {
    const adminClient = getSupabaseAdmin();
    const { error } = await adminClient.auth.admin.updateUserById(payload.userId, {
      password: payload.pin,
      user_metadata: { must_change_pin: true },
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
