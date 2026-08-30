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

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from(tables.profiles).select("*").eq("id", user.id).maybeSingle(),
    supabase.from(tables.userRoles).select("role").eq("user_id", user.id),
  ]);

  const roleList = (roles ?? []).map((r) => (r as { role: AppRole }).role);
  const priority: AppRole[] = ["super_admin", "admin", "supervisor", "survey_user"];
  const role = priority.find((r) => roleList.includes(r)) ?? null;

  return {
    id: user.id,
    userId: (profile as Profile | null)?.username ?? user.email?.split("@")[0] ?? "",
    email: user.email ?? "",
    role,
    profile: (profile as Profile | null) ?? null,
    mustChangePin: Boolean(user.user_metadata?.["must_change_pin"]),
  };
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
  const qaRole = localStorage.getItem("QA_ROLE") || (import.meta.env as any).VITE_QA_ROLE;
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
