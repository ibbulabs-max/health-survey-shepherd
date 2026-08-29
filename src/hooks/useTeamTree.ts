import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/db/client";
import { tables } from "@/config/database";
import type { Profile } from "@/db/types";
import { useAuth } from "./useAuth";

export interface TeamMember {
  profile: Profile;
  role: string;
}

export function useTeamTree() {
  const { user, role, isAdmin } = useAuth();

  return useQuery({
    queryKey: ["team-tree", user?.id],
    queryFn: async () => {
      if (!user?.id) return { supervisors: [], csws: [] };

      if (isAdmin) {
        const [{ data: profiles }, { data: roleRows }] = await Promise.all([
          supabase.from(tables.profiles).select("*").order("full_name"),
          supabase.from(tables.userRoles).select("user_id, role"),
        ]);
        
        const roleMap = new Map<string, string[]>();
        (roleRows ?? []).forEach((r: any) => {
          if (!r.user_id) return;
          roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
        });

        const supervisors: Profile[] = [];
        const csws: Profile[] = [];

        (profiles ?? []).forEach((p: any) => {
          const roles = roleMap.get(p.id) ?? [];
          if (roles.includes("supervisor")) supervisors.push(p);
          if (roles.includes("survey_user")) csws.push(p);
        });

        return { supervisors, csws };
      }

      if (role === "supervisor") {
        const { data: memberships } = await supabase
          .from(tables.teamMemberships)
          .select("csw_id")
          .eq("supervisor_id", user.id)
          .eq("status", "active");
          
        const cswIds = (memberships ?? []).map((m: any) => m.csw_id);
        if (!cswIds.length) return { supervisors: [user.profile!], csws: [] };
        
        const { data: profiles } = await supabase
          .from(tables.profiles)
          .select("*")
          .in("id", cswIds);
          
        return { supervisors: [user.profile!], csws: (profiles ?? []) as Profile[] };
      }

      // CSW
      return { supervisors: [], csws: [user.profile!] };
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
}
