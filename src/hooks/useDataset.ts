import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { computeStats, datasetQueryKey, loadDataset } from "@/services/dataService";

import { useGlobalFilter } from "./useGlobalFilter";

/** Shared dataset for every module — one fetch, cached, invalidated centrally. */
export function useDataset() {
  const query = useQuery({
    queryKey: datasetQueryKey,
    queryFn: loadDataset,
    staleTime: 60_000,
    retry: false,
  });

  const filter = useGlobalFilter();

  if (query.error) {
    console.error("useDataset query error:", query.error);
  }

  const data = useMemo(() => {
    if (!query.data) return null;
    let { houses, members, followUps } = query.data;

    if (filter.eligibleOnly) {
      members = members.filter((m) => m.eligible);
    }

    if (filter.chwId && filter.chwId !== "any") {
      houses = houses.filter(
        (h) => h.house.assigned_csw_id === filter.chwId || h.house.uploaded_by === filter.chwId,
      );
      const houseIds = new Set(houses.map((h) => h.house.id));
      members = members.filter((m) => m.houseUuid && houseIds.has(m.houseUuid));
    } else if (filter.supervisorId && filter.supervisorId !== "any") {
      houses = houses.filter((h) => h.house.supervisor_id === filter.supervisorId);
      const houseIds = new Set(houses.map((h) => h.house.id));
      members = members.filter((m) => m.houseUuid && houseIds.has(m.houseUuid));
    }

    // Follow-ups also shrink to match the filtered members
    const memberIds = new Set(members.map((m) => m.id));
    followUps = followUps.filter((f) => f.member_uuid && memberIds.has(f.member_uuid));

    return {
      houses,
      members,
      followUps,
      byHouseUuid: new Map(houses.map((h) => [h.house.id, h])),
      byMemberId: new Map(members.map((m) => [m.id, m])),
    };
  }, [query.data, filter.eligibleOnly, filter.supervisorId, filter.chwId]);

  const stats = useMemo(() => (data ? computeStats(data) : null), [data]);
  return { ...query, data, stats };
}

export function useRefreshDataset() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: datasetQueryKey }),
    [queryClient],
  );
}
