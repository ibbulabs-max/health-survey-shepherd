import { useQuery } from "@tanstack/react-query";
import { loadAllUsers, loadTeamMemberships, getUserDisplayName } from "@/services/userService";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: loadAllUsers,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeamMemberships() {
  return useQuery({
    queryKey: ["team_memberships"],
    queryFn: loadTeamMemberships,
    staleTime: 5 * 60 * 1000,
  });
}
