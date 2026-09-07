import { databaseConfig, tables, userIdToAuthEmail } from "@/config/database";
import type { AppRole } from "@/config/roles";
import { supabase, toUserMessage } from "@/db/client";
import type { Profile } from "@/db/types";

export interface SessionUser {
  id: string;
  userId: string;
  email: string;
  role: AppRole | null;
  profile: Profile | null;
  mustChangePin: boolean;
  actualRole: AppRole | null;
  testSession?: {
    id: string;
    simulatedRole: AppRole;
    simulatedUserId: string | null;
  } | null;
}

export const PIN_LENGTH = 6;

export async function signInWithPin(userId: string, pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be exactly 6 digits.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: userIdToAuthEmail(userId),
    password: pin,
  });
  if (error) throw new Error(toUserMessage(error, "Could not sign in."));
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function loadSessionUser(): Promise<SessionUser | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }, { data: testSession }] = await Promise.all([
    supabase.from(tables.profiles).select("*").eq("id", user.id).maybeSingle(),
    supabase.from(tables.userRoles).select("role").eq("user_id", user.id),
    supabase.from("test_mode_sessions")
      .select("*")
      .eq("master_admin_id", user.id)
      .eq("active", true)
      .maybeSingle()
      .then(res => res, () => ({ data: null })), // Catch in case table doesn't exist yet
  ]);

  const roleList = (roles ?? []).map((r: any) => (r as { role: AppRole }).role);
  const priority: AppRole[] = ["master_admin", "super_admin", "admin", "supervisor", "survey_user"];
  const actualRole = priority.find((r) => roleList.includes(r)) ?? null;
  
  // Apply test session simulation if valid
  let role = actualRole;
  let parsedTestSession = null;
  
  if (testSession && actualRole === "master_admin") {
    // Ensure it hasn't expired (handled by DB mostly, but check here too)
    const isExpired = new Date(testSession.expires_at) < new Date();
    if (!isExpired) {
      role = testSession.simulated_role as AppRole;
      parsedTestSession = {
        id: testSession.id,
        simulatedRole: testSession.simulated_role as AppRole,
        simulatedUserId: testSession.simulated_user_id,
      };
    }
  }

  return {
    id: user.id,
    userId: (profile as Profile | null)?.username ?? user.email?.split("@")[0] ?? "",
    email: user.email ?? "",
    role,
    actualRole,
    profile: (profile as Profile | null) ?? null,
    mustChangePin: Boolean(user.user_metadata?.["must_change_pin"]),
    testSession: parsedTestSession,
  };
}

export async function startTestMode(simulatedRole: AppRole, simulatedUserId: string | null = null) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");
  
  // Create or update active test mode session
  const { error } = await supabase.from("test_mode_sessions").insert({
    master_admin_id: userData.user.id,
    simulated_role: simulatedRole,
    simulated_user_id: simulatedUserId,
    active: true
  });
  
  if (error) throw new Error(toUserMessage(error, "Could not start test mode."));
}

export async function endTestMode() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  
  // Deactivate all test sessions for this user
  const { error } = await supabase.from("test_mode_sessions")
    .update({ active: false, expires_at: new Date().toISOString() })
    .eq("master_admin_id", userData.user.id)
    .eq("active", true);
    
  if (error) throw new Error(toUserMessage(error, "Could not end test mode."));
}

export async function changePin(newPin: string) {
  if (!/^\d{6}$/.test(newPin)) throw new Error("PIN must be exactly 6 digits.");
  const { error } = await supabase.auth.updateUser({
    password: newPin,
    data: { must_change_pin: false },
  });
  if (error) throw new Error(toUserMessage(error, "Could not update your PIN."));
}

export async function autoSignInQA() {
  if (!import.meta.env.DEV) return;
  const qaRole =
    (typeof window !== "undefined" ? localStorage.getItem("QA_ROLE") : null) ||
    (import.meta.env as any).VITE_QA_ROLE;
  if (!qaRole) return;

  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const qaUsers: Record<string, string> = {
    admin: (import.meta.env as any).VITE_QA_ADMIN_USER || "admin-placeholder",
    supervisor: (import.meta.env as any).VITE_QA_SUP_USER || "sup-placeholder",
    chw: (import.meta.env as any).VITE_QA_CHW_USER || "chw-placeholder",
  };
  const targetUser = qaUsers[qaRole.toLowerCase()];
  if (targetUser) {
    try {
      await signInWithPin(targetUser, (import.meta.env as any).VITE_QA_PASSWORD || "000000");
      console.log(`[QA] Automatically signed in as ${targetUser}`);
    } catch (e) {
      console.error("[QA] Auto sign-in failed", e);
    }
  }
}

export const authEmailDomain = databaseConfig.identityDomain;
