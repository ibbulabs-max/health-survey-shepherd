import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { riskLabels, type RiskLevel } from "@/config/risk";
import { useDataset } from "@/hooks/useDataset";
import { cn } from "@/lib/utils";

const HouseMap = lazy(() => import("@/components/map/HouseMap"));

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Map — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Household GPS map with risk-coloured pins, unmapped house tracking and one-tap navigation.",
      },
      { property: "og:title", content: "Map — Management App" },
      {
        property: "og:description",
        content: "Risk-coloured household pins with one-tap navigation.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const [filter, setFilter] = useState<"all" | RiskLevel>("all");

  const mapped = useMemo(
    () =>
      (data?.houses ?? [])
        .filter((h) => h.hasLocation)
        .filter((h) => filter === "all" || h.risk === filter),
    [data, filter],
  );

  if (isLoading) return <LoadingState label="Loading map data…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );

  const unmapped = (data?.houses ?? []).filter((h) => !h.hasLocation).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Map"
        subtitle={`${mapped.length} mapped households • ${unmapped} still need a GPS pin`}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "high", "moderate", "low"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground",
            )}
          >
            {key === "all" ? "All" : riskLabels[key]}
          </button>
        ))}
      </div>

      {mapped.length === 0 ? (
        <EmptyState
          title="No mapped households yet"
          description="Pin a household from its detail page, or import files that include latitude and longitude."
        />
      ) : (
        <div className="card-surface h-[65vh] overflow-hidden p-0">
          <Suspense fallback={<LoadingState label="Loading map…" />}>
            <HouseMap houses={mapped} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
