import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  Home,
  MapPin,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";
import { followUpStatus, priorityScore, toDateKey } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Live overview of households, screened members, risk distribution, today's follow-ups and data quality alerts.",
      },
      { property: "og:title", content: "Home — Management App" },
      {
        property: "og:description",
        content: "Live overview of households, screening progress, risk and follow-ups.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, role, can } = useAuth();
  const { data, stats, isLoading, error, refetch } = useDataset();

  if (isLoading) return <LoadingState label="Loading your overview…" />;
  if (error)
    return (
      <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => void refetch()} />
    );
  if (!data || !stats) return null;

  const today = toDateKey(new Date());
  const priority = data.members
    .map((m) => {
      const pending = data.followUps.filter(
        (f) =>
          f.member_uuid === m.id &&
          ["due", "overdue"].includes(followUpStatus(f.status, f.due_date)),
      );
      const overdueDays = pending.reduce((max, f) => {
        if (!f.due_date || f.due_date >= today) return max;
        const days = Math.round(
          (Date.now() - new Date(f.due_date).getTime()) / 86_400_000,
        );
        return Math.max(max, days);
      }, 0);
      return {
        member: m,
        score: priorityScore({
          risk: m.risk,
          overdueDays,
          conditions: m.conditions.length,
          dataIssues: m.dataIssues.length,
          missingCondition: m.dataIssues.includes("Known condition may be missing"),
        }),
      };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${user?.profile?.full_name?.split(" ")[0] ?? user?.userId ?? "there"}`}
        subtitle={`${role ? roleLabels[role] : "No role"} • ${stats.houses} households in your view`}
        actions={
          can("import_data") ? (
            <Button asChild className="rounded-xl">
              <Link to="/import">Smart Import</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Houses" value={stats.houses} icon={Home} to="/houses" hint={`${stats.mappedHouses} mapped`} />
        <StatCard label="Members" value={stats.members} icon={Users} hint={`${stats.eligible} eligible (30+)`} />
        <StatCard
          label="Screened"
          value={stats.screened}
          icon={Stethoscope}
          tone="primary"
          hint={`${stats.pendingScreening} pending`}
        />
        <StatCard
          label="Unmapped"
          value={stats.houses - stats.mappedHouses}
          icon={MapPin}
          to="/map"
          hint="Need GPS pin"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <StatCard label="High risk" value={stats.risk.high} tone="high" hint="Members needing urgent contact" to="/analytics" />
        <StatCard label="Moderate risk" value={stats.risk.moderate} tone="moderate" hint="Watch and review" to="/analytics" />
        <StatCard label="Low risk" value={stats.risk.low} tone="low" hint="Routine follow-up" to="/analytics" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-base font-semibold">Today's follow-ups</p>
              <p className="text-xs text-muted-foreground">Sundays are always excluded</p>
            </div>
            <CalendarCheck className="size-5 text-primary" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Due", value: stats.pendingToday },
              { label: "Completed", value: stats.completedToday },
              { label: "Overdue", value: stats.overdue },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-surface-muted p-3">
                <p className="font-display text-xl font-semibold tabular-nums">{item.value}</p>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <Button asChild variant="secondary" className="mt-4 w-full rounded-xl">
            <Link to="/followups">Open follow-ups</Link>
          </Button>
        </div>

        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-base font-semibold">Data quality</p>
              <p className="text-xs text-muted-foreground">Nothing is deleted — only flagged</p>
            </div>
            <Sparkles className="size-5 text-primary" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="font-display text-3xl font-semibold tabular-nums">
              {stats.dataQualityAlerts}
            </p>
            <p className="text-sm text-muted-foreground">open alerts</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Missing readings, incomplete conditions and possible duplicates across all imports.
          </p>
          <Button asChild variant="secondary" className="mt-4 w-full rounded-xl">
            <Link to="/quality">Review alerts</Link>
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-risk-high" />
          <h2 className="font-display text-base font-semibold">Priority members</h2>
        </div>
        {priority.length === 0 ? (
          <EmptyState
            title="No priority cases yet"
            description="Once households are imported and screened, the highest-need members appear here automatically."
          />
        ) : (
          <div className="grid gap-2">
            {priority.map(({ member, score }) => (
              <Link
                key={member.id}
                to="/houses/$houseId"
                params={{ houseId: member.houseUuid ?? "" }}
                className="card-surface flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-float"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.age != null ? `${member.age}y` : "Age unknown"} •{" "}
                    {member.systolic && member.diastolic
                      ? `BP ${member.systolic}/${member.diastolic}`
                      : "BP not recorded"}{" "}
                    • {member.bloodSugar != null ? `Sugar ${member.bloodSugar}` : "Sugar not recorded"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{score}</span>
                  <RiskBadge level={member.risk} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
