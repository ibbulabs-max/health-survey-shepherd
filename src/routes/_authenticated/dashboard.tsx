import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  Home,
  MapPin,
  Sparkles,
  Stethoscope,
  Users,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { useState, useMemo } from "react";

import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";
import { useUsers, useTeamMemberships } from "@/hooks/useUsers";
import { followUpStatus, priorityScore, type HouseView } from "@/lib/domain";
import { computeStats } from "@/services/dataService";
import { getUserDisplayName } from "@/services/userService";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Operational overview of household surveys, clinical screening coverage, high-risk cases and follow-up workload.",
      },
      { property: "og:title", content: "Dashboard — Management App" },
      {
        property: "og:description",
        content: "Operational overview of surveys, screenings, risk and follow-ups.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user, role, can } = useAuth();
  const { data: originalData, stats: originalStats, isLoading, error, refetch } = useDataset();
  const { data: users } = useUsers();
  const { data: teamMemberships } = useTeamMemberships();
  const [selectedHouse, setSelectedHouse] = useState<HouseView | null>(null);
  const [onlyEligible, setOnlyEligible] = useState(false);

  const data = useMemo(() => {
    if (!originalData) return originalData;
    return onlyEligible
      ? { ...originalData, members: originalData.members.filter((m) => m.eligible) }
      : originalData;
  }, [originalData, onlyEligible]);

  const stats = useMemo(() => {
    if (!data || !originalStats) return originalStats;
    return onlyEligible ? computeStats(data) : originalStats;
  }, [data, originalStats, onlyEligible]);

  if (isLoading) return <DashboardSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );
  if (!data || !stats) return null;

  const today = new Date().toISOString().slice(0, 10);

  const priority = data.members
    .map((m) => {
      const pendingFollowUp = data.followUps.find(
        (f) => f.member_uuid === m.id && f.status === "pending",
      );
      const overdueDays =
        pendingFollowUp && pendingFollowUp.due_date
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(pendingFollowUp.due_date).getTime()) / 86_400_000),
            )
          : 0;

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

  // Supervisor Team Data
  const isSupervisor = role === "supervisor" || role === "admin" || role === "super_admin";
  const myTeam =
    teamMemberships?.filter((tm) => tm.supervisor_id === user?.userId && tm.status === "active") ||
    [];

  const teamStats = myTeam.map((tm) => {
    const cswUser = users?.find((u) => u.profile.id === tm.csw_id);
    const cswHouses = data.houses.filter((h) => h.house.assigned_csw_id === tm.csw_id);
    const cswMembers = data.members.filter((m) =>
      cswHouses.some((h) => h.house.id === m.houseUuid),
    );
    const cswFollowUps = data.followUps.filter((f) =>
      cswMembers.some((m) => m.id === f.member_uuid),
    );

    return {
      cswId: tm.csw_id,
      name: getUserDisplayName(cswUser),
      houses: cswHouses.length,
      members: cswMembers.length,
      highRisk: cswMembers.filter((m) => m.risk === "high").length,
      moderateRisk: cswMembers.filter((m) => m.risk === "moderate").length,
      lowRisk: cswMembers.filter((m) => m.risk === "low").length,
      todayDue: cswFollowUps.filter((f) => followUpStatus(f.status, f.due_date) === "due").length,
      overdue: cswFollowUps.filter((f) => followUpStatus(f.status, f.due_date) === "overdue")
        .length,
      completedToday: cswFollowUps.filter(
        (f) =>
          followUpStatus(f.status, f.due_date) === "completed" && f.updated_at?.startsWith(today),
      ).length,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${user?.profile?.full_name?.split(" ")[0] ?? user?.userId ?? "there"}`}
        subtitle={`${role ? roleLabels[role] : "No role"} • ${stats.houses} households in your view`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2 mr-2 bg-card px-3 py-2 rounded-xl shadow-xs border border-border/50">
              <Switch id="eligible-mode" checked={onlyEligible} onCheckedChange={setOnlyEligible} />
              <Label
                htmlFor="eligible-mode"
                className="text-sm cursor-pointer font-medium whitespace-nowrap"
              >
                Eligible Members
              </Label>
            </div>
            {role === "survey_user" && (
              <Button
                asChild
                className="rounded-xl font-semibold shadow-xs bg-primary text-primary-foreground"
              >
                <Link to="/survey/new">
                  <Plus className="size-4 mr-1.5 stroke-[2.5]" /> New Survey
                </Link>
              </Button>
            )}
            {role === "supervisor" && (
              <Button
                asChild
                className="rounded-xl font-semibold shadow-xs bg-primary text-primary-foreground"
              >
                <Link to="/team">
                  <Users className="size-4 mr-1.5 stroke-[2.5]" /> Team
                </Link>
              </Button>
            )}
            {role === "admin" && (
              <Button
                asChild
                className="rounded-xl font-semibold shadow-xs bg-primary text-primary-foreground"
              >
                <Link to="/users">
                  <ShieldCheck className="size-4 mr-1.5 stroke-[2.5]" /> User Management
                </Link>
              </Button>
            )}
            {can("import_data") ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/import">Smart Import</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Houses"
          value={stats.houses}
          icon={Home}
          to="/houses"
          hint={`${stats.mappedHouses} mapped`}
        />
        <StatCard
          label="Members"
          value={stats.members}
          icon={Users}
          hint={`${stats.eligible} eligible (30+)`}
        />
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
        <StatCard
          label="High risk"
          value={stats.risk.high}
          tone="high"
          hint="Members needing urgent contact"
          to="/analytics"
        />
        <StatCard
          label="Moderate risk"
          value={stats.risk.moderate}
          tone="moderate"
          hint="Watch and review"
          to="/analytics"
        />
        <StatCard
          label="Low risk"
          value={stats.risk.low}
          tone="normal"
          hint="Routine follow-up"
          to="/analytics"
        />
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

      {isSupervisor && myTeam.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <h2 className="font-display text-base font-semibold">My Team (CSWs)</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {teamStats.map((ts) => (
              <div key={ts.cswId} className="card-surface p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{ts.name}</h3>
                    <p className="text-xs text-muted-foreground">CSW / CHW</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-risk-high/10 text-risk-high px-2 py-1 rounded-full">
                      {ts.highRisk} High
                    </span>
                    <span className="bg-risk-moderate/10 text-risk-moderate px-2 py-1 rounded-full">
                      {ts.moderateRisk} Mod
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="bg-surface-muted p-2 rounded-lg text-center">
                    <p className="text-sm font-semibold tabular-nums">{ts.houses}</p>
                    <p className="text-[10px] text-muted-foreground">Houses</p>
                  </div>
                  <div className="bg-surface-muted p-2 rounded-lg text-center">
                    <p className="text-sm font-semibold tabular-nums">{ts.members}</p>
                    <p className="text-[10px] text-muted-foreground">Members</p>
                  </div>
                  <div className="bg-surface-muted p-2 rounded-lg text-center">
                    <p className="text-sm font-semibold tabular-nums text-risk-high">
                      {ts.overdue}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Overdue</p>
                  </div>
                  <div className="bg-surface-muted p-2 rounded-lg text-center">
                    <p className="text-sm font-semibold tabular-nums text-primary">
                      {ts.completedToday}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Done</p>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link to="/reports" search={{ csw: ts.cswId }}>
                    View CSW Performance
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {priority.map(({ member, score }) => {
              const memberHouse = member.houseUuid ? data.byHouseUuid.get(member.houseUuid) : null;
              return (
                <div
                  key={member.id}
                  onClick={() => {
                    if (memberHouse) setSelectedHouse(memberHouse);
                  }}
                  className="card-surface flex items-center justify-between gap-3 p-4 transition-all hover:border-primary/40 cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.age != null ? `${member.age}y` : "Age unknown"} •{" "}
                      {member.systolic && member.diastolic
                        ? `BP ${member.systolic}/${member.diastolic}`
                        : "BP not recorded"}{" "}
                      •{" "}
                      {member.bloodSugar != null
                        ? `Sugar ${member.bloodSugar}`
                        : "Sugar not recorded"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{score}</span>
                    <RiskBadge level={member.risk} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Unified House Detail Bottom Sheet */}
      <HouseDetailSheet
        house={selectedHouse}
        open={Boolean(selectedHouse)}
        onOpenChange={(open) => !open && setSelectedHouse(null)}
      />
    </div>
  );
}
