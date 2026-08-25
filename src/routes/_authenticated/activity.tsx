import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { loadActivity } from "@/services/activityService";

export const Route = createFileRoute("/_authenticated/activity")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activity Log — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Audit trail of imports, screenings, follow-ups and household location updates by user and time.",
      },
      { property: "og:title", content: "Activity Log — Management App" },
      { property: "og:description", content: "Audit trail of every change made in the app." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => loadActivity(200),
    enabled: can("view_audit_log"),
  });

  if (!can("view_audit_log"))
    return <EmptyState title="Restricted" description="Only administrators can view the audit log." />;
  if (query.isLoading) return <LoadingState label="Loading activity…" />;
  if (query.error)
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Unknown error"}
        onRetry={() => void query.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <PageHeader title="Activity Log" subtitle="Newest first" />
      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No activity recorded yet" />
      ) : (
        <div className="grid gap-2">
          {(query.data ?? []).map((log) => (
            <div key={log.id} className="card-surface p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{log.action}</p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                </p>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {log.username ?? "system"}
                {log.details ? ` • ${JSON.stringify(log.details)}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
