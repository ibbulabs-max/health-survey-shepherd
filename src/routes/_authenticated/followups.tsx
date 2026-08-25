import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Check, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import { followUpConfig } from "@/config/followups";
import { asRisk } from "@/lib/domain";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { followUpStatus, toDateKey } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  completeFollowUp,
  planWorkload,
  rescheduleFollowUp,
  skipFollowUp,
} from "@/services/followUpService";

export const Route = createFileRoute("/_authenticated/followups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Today, overdue and upcoming follow-ups with risk-based intervals, Sunday exclusion and daily workload planning.",
      },
      { property: "og:title", content: "Follow-ups — Management App" },
      {
        property: "og:description",
        content: "Risk-based follow-up scheduling that never falls on a Sunday.",
      },
    ],
  }),
  component: FollowUpsPage,
});

type Tab = "today" | "overdue" | "upcoming" | "done";

function FollowUpsPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const refresh = useRefreshDataset();
  const [tab, setTab] = useState<Tab>("today");

  const complete = useMutation({
    mutationFn: (id: string) => completeFollowUp(id),
    onSuccess: () => {
      toast.success("Follow-up completed.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update follow-up."),
  });
  const skip = useMutation({
    mutationFn: (id: string) => skipFollowUp(id),
    onSuccess: () => {
      toast.success("Follow-up skipped.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update follow-up."),
  });
  const postpone = useMutation({
    mutationFn: (id: string) => {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      return rescheduleFollowUp(id, next);
    },
    onSuccess: () => {
      toast.success("Moved to the next working day.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reschedule."),
  });

  const today = toDateKey(new Date());
  const grouped = useMemo(() => {
    const list = data?.followUps ?? [];
    return {
      today: list.filter(
        (f) => (f.due_date ?? "") === today && followUpStatus(f.status, f.due_date) !== "completed",
      ),
      overdue: list.filter((f) => followUpStatus(f.status, f.due_date) === "overdue"),
      upcoming: list.filter(
        (f) =>
          (f.due_date ?? "") > today && followUpStatus(f.status, f.due_date) !== "completed",
      ),
      done: list.filter((f) => followUpStatus(f.status, f.due_date) === "completed"),
    };
  }, [data, today]);

  if (isLoading) return <LoadingState label="Loading follow-ups…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );

  const visible = grouped[tab];
  const plan = planWorkload(grouped.today.length + grouped.overdue.length);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "today", label: "Today", count: grouped.today.length },
    { key: "overdue", label: "Overdue", count: grouped.overdue.length },
    { key: "upcoming", label: "Upcoming", count: grouped.upcoming.length },
    { key: "done", label: "Completed", count: grouped.done.length },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Follow-ups"
        subtitle={`High risk every ${followUpConfig.intervalDays.high} days • Moderate ${followUpConfig.intervalDays.moderate} • Low ${followUpConfig.intervalDays.low} • Never on Sundays`}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground",
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {plan.length > 1 && (tab === "today" || tab === "overdue") ? (
        <div className="card-surface flex items-start gap-3 p-4">
          <CalendarClock className="mt-0.5 size-4.5 text-primary" />
          <div>
            <p className="text-sm font-medium">Workload plan</p>
            <p className="text-xs text-muted-foreground">
              {grouped.today.length + grouped.overdue.length} visits spread over{" "}
              {plan.length} working days at {followUpConfig.defaultDailyTarget} per day (
              {plan
                .slice(0, 3)
                .map((d) => `${d.date}: ${d.load}`)
                .join(", ")}
              …)
            </p>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="Follow-ups are created automatically after each screening, using the configured risk intervals."
        />
      ) : (
        <div className="grid gap-2">
          {visible
            .slice()
            .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
            .map((f) => {
              const member = f.member_uuid ? data?.byMemberId.get(f.member_uuid) : null;
              return (
                <div key={f.id} className="card-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member?.name ?? "Household visit"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.reason ?? "Follow-up"} • due {f.due_date ?? "—"}
                      </p>
                      {member?.systolic && member.diastolic ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last BP {member.systolic}/{member.diastolic}
                          {member.bloodSugar != null ? ` • Sugar ${member.bloodSugar}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <RiskBadge level={asRisk(f.risk_level ?? member?.risk ?? "low")} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {tab !== "done" ? (
                      <>
                        <Button
                          size="sm"
                          className="rounded-xl"
                          disabled={complete.isPending}
                          onClick={() => complete.mutate(f.id)}
                        >
                          <Check className="size-4" /> Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-xl"
                          disabled={postpone.isPending}
                          onClick={() => postpone.mutate(f.id)}
                        >
                          Next working day
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-muted-foreground"
                          disabled={skip.isPending}
                          onClick={() => skip.mutate(f.id)}
                        >
                          <SkipForward className="size-4" /> Skip
                        </Button>
                      </>
                    ) : null}
                    {f.house_uuid ? (
                      <Button asChild size="sm" variant="ghost" className="rounded-xl text-primary">
                        <Link to="/houses/$houseId" params={{ houseId: f.house_uuid }}>
                          Open household
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
