import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo } from "react";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { useDataset } from "@/hooks/useDataset";
import { useTeamMemberships, useUsers } from "@/hooks/useUsers";
import { getUserDisplayName } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";

const MapView = lazy(() =>
  import("@/components/map/MapView").then((m) => ({ default: m.MapView })),
);

const mapSearchSchema = z.object({
  houseId: z.string().optional(),
  filter: z.enum(["today_followups"]).optional(),
});

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  validateSearch: mapSearchSchema,
  head: () => ({
    meta: [
      { title: "Map — Management App by Ibrahim Labs" },
      {
        name: "description",
        content: "Interactive GPS survey map with pins, filters, and house details.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useDataset();
  const { data: users } = useUsers();
  const { data: teamMemberships } = useTeamMemberships();

  const search = Route.useSearch();

  let houses = data?.houses ?? [];
  const followUps = data?.followUps ?? [];
  const members = data?.members ?? [];

  if (search.filter === "today_followups") {
    // Find all follow-ups due today
    const today = new Date();
    // Reset to midnight local time for comparison
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const housesWithFollowups = new Set<string>();

    for (const f of followUps) {
      if (f.status !== "completed" && f.status !== "missed") {
        let dueDate: Date | null = null;
        if (f.due_date) {
          const d = new Date(f.due_date);
          if (!isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            dueDate = d;
          }
        }

        if (dueDate && dueDate.getTime() <= todayTime) {
          const m = members.find((x) => x.id === f.member_uuid);
          if (m && m.houseUuid) {
            housesWithFollowups.add(m.houseUuid);
          }
        }
      }
    }

    houses = houses.filter((h) => housesWithFollowups.has(h.house.id));
  }

  const teamMembers = useMemo(() => {
    if (!teamMemberships || !users || !user) return [];
    const myTeam = teamMemberships.filter(
      (tm) => tm.supervisor_id === user.userId && tm.status === "active",
    );
    return myTeam.map((tm) => {
      const u = users.find((u) => u.profile.id === tm.csw_id);
      return { id: tm.csw_id, name: getUserDisplayName(u) };
    });
  }, [teamMemberships, users, user]);

  if (isLoading) return <LoadingState label="Loading map & pins…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load map data."}
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="w-full">
      <Suspense fallback={<LoadingState label="Loading Map View…" />}>
        <MapView
          houses={houses}
          teamMembers={teamMembers}
          focusedHouseId={search.houseId ?? null}
        />
      </Suspense>
    </div>
  );
}
