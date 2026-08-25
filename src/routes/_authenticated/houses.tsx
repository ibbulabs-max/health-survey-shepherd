import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/config/app";
import { riskLabels, type RiskLevel } from "@/config/risk";
import { useDataset } from "@/hooks/useDataset";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/houses")({
  head: () => ({
    meta: [
      { title: "Households — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Search, filter and open every mapped household with members, risk levels and screening progress.",
      },
      { property: "og:title", content: "Households — Management App" },
      {
        property: "og:description",
        content: "Search and filter households by risk, mapping status and screening progress.",
      },
    ],
  }),
  component: HousesPage,
});

type Filter = "all" | RiskLevel | "unmapped" | "pending";

function HousesPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState<number>(appConfig.pagination.defaultPageSize);

  const houses = useMemo(() => {
    const list = data?.houses ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((h) => {
        if (filter === "unmapped") return !h.hasLocation;
        if (filter === "pending") return h.eligible > h.screened;
        if (filter !== "all") return h.risk === filter;
        return true;
      })
      .filter((h) => {
        if (q.length < appConfig.search.minChars) return true;
        const haystack = [
          h.house.house_id,
          h.house.house_number,
          h.house.address,
          h.house.owner_name,
          ...h.members.map((m) => m.name),
          ...h.members.map((m) => m.memberId),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.counts.high - a.counts.high || b.members.length - a.members.length);
  }, [data, query, filter]);

  if (isLoading) return <LoadingState label="Loading households…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "high", label: riskLabels.high },
    { key: "moderate", label: riskLabels.moderate },
    { key: "low", label: riskLabels.low },
    { key: "pending", label: "Pending screening" },
    { key: "unmapped", label: "Unmapped" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Households" subtitle={`${houses.length} of ${data?.houses.length ?? 0} shown`} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search house ID, address, owner or member name"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {houses.length === 0 ? (
        <EmptyState
          title="No households match"
          description="Try a different search or filter, or import a data file to get started."
        />
      ) : (
        <div className="grid gap-2">
          {houses.slice(0, limit).map((h) => (
            <Link
              key={h.house.id}
              to="/houses/$houseId"
              params={{ houseId: h.house.id }}
              className="card-surface flex items-start justify-between gap-3 p-4 transition-shadow hover:shadow-float"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {h.house.house_id ?? h.house.house_number ?? "Unnumbered house"}
                  {h.house.owner_name ? ` • ${h.house.owner_name}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {h.house.address ?? "No address recorded"}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {h.members.length} members • {h.eligible} eligible • {h.screened} screened
                  {h.pendingFollowUps ? ` • ${h.pendingFollowUps} follow-ups` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <RiskBadge level={h.risk} />
                {!h.hasLocation ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" /> Unmapped
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
          {houses.length > limit ? (
            <button
              onClick={() => setLimit((n) => n + appConfig.pagination.defaultPageSize)}
              className="mt-1 rounded-xl border border-border bg-surface py-3 text-sm font-medium text-primary"
            >
              Load more ({houses.length - limit} remaining)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
