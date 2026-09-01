import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { computeStats, datasetQueryKey, loadDataset } from "@/services/dataService";

/** Shared dataset for every module — one fetch, cached, invalidated centrally. */
export function useDataset() {
  const query = useQuery({
    queryKey: datasetQueryKey,
    queryFn: loadDataset,
    staleTime: 60_000,
    retry: false,
  });

  if (query.error) {
    console.error("useDataset query error:", query.error);
  }

  const stats = useMemo(() => (query.data ? computeStats(query.data) : null), [query.data]);
  return { ...query, stats };
}

export function useRefreshDataset() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: datasetQueryKey }),
    [queryClient],
  );
}
