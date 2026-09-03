import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { GlobalFilterSheet } from "@/components/common/GlobalFilterSheet";
import { useDataset } from "@/hooks/useDataset";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({
    meta: [
      { title: "Data Quality — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Missing readings, incomplete conditions, invalid values and possible duplicate people flagged across every import.",
      },
      { property: "og:title", content: "Data Quality — Management App" },
      {
        property: "og:description",
        content: "Flagged missing readings, invalid values and possible duplicate records.",
      },
    ],
  }),
  component: QualityPage,
});

function QualityPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const [issue, setIssue] = useState<string>("all");

  const { flagged, issueTypes } = useMemo(() => {
    const members = (data?.members ?? []).filter((m) => m.dataIssues.length > 0);
    const types = new Map<string, number>();
    members.forEach((m) => m.dataIssues.forEach((i) => types.set(i, (types.get(i) ?? 0) + 1)));
    return {
      flagged: members
        .filter((m) => issue === "all" || m.dataIssues.includes(issue))
        .sort((a, b) => b.dataIssues.length - a.dataIssues.length),
      issueTypes: [...types.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data, issue]);

  if (isLoading) return <LoadingState label="Checking data quality…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Quality"
        subtitle="Records are never deleted or auto-corrected — they are flagged for a human to confirm."
        actions={<GlobalFilterSheet />}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[["all", flagged.length] as const, ...issueTypes].map(([key, count]) => (
          <button
            key={key}
            onClick={() => setIssue(key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              issue === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground",
            )}
          >
            {key === "all" ? "All flags" : key} ({count})
          </button>
        ))}
      </div>

      {flagged.length === 0 ? (
        <EmptyState
          title="No data quality flags"
          description="Every member record has the readings and details needed for reliable risk scoring."
        />
      ) : (
        <div className="grid gap-2">
          {flagged.slice(0, 200).map((m) => (
            <Link
              key={m.id}
              to="/members/$memberId"
              search={{ fix: "true" }}
              params={{ memberId: m.id }}
              className="card-surface flex items-start justify-between gap-3 p-4 transition-shadow hover:shadow-float border border-risk-moderate-soft"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name || "Unknown Member"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[m.houseId ? `House ${m.houseId}` : null, m.memberId || null]
                    .filter(Boolean)
                    .join(" • ") || "No ID"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.dataIssues.map((issue) => (
                    <span
                      key={issue}
                      className="text-[10px] font-medium text-risk-moderate bg-risk-moderate-soft px-2 py-0.5 rounded-md"
                    >
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <RiskBadge level={m.risk} />
                <span className="text-[10px] text-primary font-medium hover:underline">
                  Fix Issue &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
