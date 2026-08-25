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

export const authEmailDomain = databaseConfig.identityDomain;
