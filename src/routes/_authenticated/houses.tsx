import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Search, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/config/app";
import { riskLabels, type RiskLevel } from "@/config/risk";
import { useDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ArrowRightLeft, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteHouses } from "@/services/houseService";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
import type { HouseView } from "@/lib/domain";
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
  const { role } = useAuth();
  const { data, isLoading, error, refetch } = useDataset();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState<number>(appConfig.pagination.defaultPageSize);
  const [selectedHouse, setSelectedHouse] = useState<HouseView | null>(null);

  // Admin/Supervisor Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHouseUuids, setSelectedHouseUuids] = useState<string[]>([]);

  const handleToggleHouse = (uuid: string) => {
    setSelectedHouseUuids((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid],
    );
  };

  const handleSelectAll = () => {
    const ids = houses.slice(0, limit).map((h) => h.house.id);
    setSelectedHouseUuids(ids);
  };

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedHouseUuids.length} houses? This will also delete related members and assessments forever.`,
      )
    )
      return;

    try {
      await bulkDeleteHouses(selectedHouseUuids);
      toast.success(`Deleted ${selectedHouseUuids.length} houses successfully.`);
      setSelectedHouseUuids([]);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete houses.");
    }
  };

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
    { key: "normal", label: riskLabels.normal },
    { key: "pending", label: "Pending screening" },
    { key: "unmapped", label: "Unmapped" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Households"
        subtitle={`${houses.length} of ${data?.houses.length ?? 0} shown`}
        actions={
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "supervisor") && (
              <Button
                variant={isSelectionMode ? "secondary" : "outline"}
                size="sm"
                className="rounded-xl font-semibold shadow-xs"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) setSelectedHouseUuids([]);
                }}
              >
                <ListChecks className="size-4 mr-1.5" />
                {isSelectionMode ? "Cancel Selection" : "Select"}
              </Button>
            )}
            {role === "survey_user" && (
              <Button asChild className="rounded-xl font-semibold shadow-xs">
                <Link to="/survey/new" search={{ mode: "new" }}>
                  <Plus className="size-4 mr-1.5" /> Create House
                </Link>
              </Button>
            )}
          </div>
        }
      />

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
                ? "border-primary bg-primary text-primary-foreground font-semibold"
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
            <div
              key={h.house.id}
              onClick={() => {
                if (isSelectionMode) {
                  handleToggleHouse(h.house.id);
                } else {
                  setSelectedHouse(h);
                }
              }}
              className={cn(
                "card-surface flex items-start gap-3 p-4 transition-all hover:border-primary/40 cursor-pointer shadow-xs active:scale-[0.99]",
                isSelectionMode && selectedHouseUuids.includes(h.house.id) && "ring-2 ring-primary bg-primary/5",
              )}
            >
              {isSelectionMode && (
                <div className="pt-1 pr-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedHouseUuids.includes(h.house.id)}
                    onCheckedChange={() => handleToggleHouse(h.house.id)}
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {h.house.house_id ?? h.house.house_number ?? "Unnumbered house"}
                  {h.house.owner_name ? ` • ${h.house.owner_name}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground mt-0.5">
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
            </div>
          ))}
          {houses.length > limit ? (
            <button
              onClick={() => setLimit((n) => n + appConfig.pagination.defaultPageSize)}
              className="mt-1 rounded-xl border border-border bg-surface py-3 text-sm font-medium text-primary hover:bg-surface-muted"
            >
              Load more ({houses.length - limit} remaining)
            </button>
          ) : null}
        </div>
      )}

      {isSelectionMode && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-30 flex flex-col sm:flex-row sm:items-center justify-between safe-bottom shadow-[0_-4px_24px_-2px_oklch(0_0_0/0.05)] gap-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{selectedHouseUuids.length} selected</span>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            {selectedHouseUuids.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedHouseUuids([])}>
                Deselect All
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedHouseUuids([]);
              }}
            >
              Cancel
            </Button>
            <Button variant="secondary" size="sm" disabled={selectedHouseUuids.length === 0} onClick={() => toast.info("Transfer feature coming soon")}>
              <ArrowRightLeft className="size-4 mr-1.5" /> Transfer
            </Button>
            {role === "admin" && (
              <Button variant="destructive" size="sm" disabled={selectedHouseUuids.length === 0} onClick={handleBulkDelete}>
                <Trash2 className="size-4 mr-1.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Global Unified House Detail Bottom Sheet */}
      <HouseDetailSheet
        house={selectedHouse}
        open={Boolean(selectedHouse)}
        onOpenChange={(open) => !open && setSelectedHouse(null)}
      />
    </div>
  );
}
