import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo } from "react";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { useDataset } from "@/hooks/useDataset";
import { useTeamMemberships, useUsers } from "@/hooks/useUsers";
import { getUserDisplayName } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";

const MapView = lazy(() =>
  import("@/components/map/MapView").then((m) => ({ default: m.MapView }))
);

const mapSearchSchema = z.object({
  houseId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  validateSearch: mapSearchSchema,
  head: () => ({
    meta: [
      { title: "Map — Management App by Ibrahim Labs" },
      { name: "description", content: "Interactive GPS survey map with pins, filters, and house details." },
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

  const houses = data?.houses ?? [];
  
  const teamMembers = useMemo(() => {
    if (!teamMemberships || !users || !user) return [];
    const myTeam = teamMemberships.filter(tm => tm.supervisor_id === user.userId && tm.status === "active");
    return myTeam.map(tm => {
      const u = users.find(u => u.profile.id === tm.csw_id);
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
        <MapView houses={houses} teamMembers={teamMembers} focusedHouseId={search.houseId ?? null} />
      </Suspense>
    </div>
  );
}
