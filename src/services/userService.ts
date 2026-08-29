import { supabase } from "@/db/client";
import { tables } from "@/config/database";
import type { Profile } from "@/db/types";
import type { AppRole } from "@/config/roles";

export interface UserView {
  profile: Profile;
  roles: AppRole[];
}

export interface TeamMembership {
  id: number;
  supervisor_id: string;
  csw_id: string;
  status: "active" | "inactive";
}

export async function loadAllUsers(): Promise<UserView[]> {
  const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
      supabase.from(tables.profiles).select("*").order("created_at"),
      supabase.from(tables.userRoles).select("user_id, role"),
    ]);

  if (profileError) throw profileError;
  if (roleError) throw roleError;

  const roleMap = new Map<string, AppRole[]>();
  (roles ?? []).forEach((r) => {
    const row = r as { user_id: string | null; role: AppRole };
    if (!row.user_id) return;
    roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role]);
  });

  return ((profiles ?? []) as Profile[]).map((p) => ({
    profile: p,
    roles: roleMap.get(p.id) ?? [],
  }));
}

export async function loadTeamMemberships(): Promise<TeamMembership[]> {
  const { data, error } = await supabase.from("team_memberships").select("*");
  if (error) throw error;
  return data as TeamMembership[];
}

export function getUserDisplayName(user?: UserView | null): string {
  if (!user) return "Unknown User";
  return user.profile.full_name || user.profile.username || "Unknown User";
}
