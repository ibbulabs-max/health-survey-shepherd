import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Activity, Home, ShieldAlert, ArrowRight, User } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";
import { loadAllUsers, loadTeamMemberships, type UserView } from "@/services/userService";
import { RiskBadge } from "@/components/common/RiskBadge";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

function TeamPage() {
  const { user, can } = useAuth();
  const { data: dataset, isLoading: datasetLoading } = useDataset();

  const queryUsers = useQuery({
    queryKey: ["users"],
    queryFn: loadAllUsers,
    enabled: can("manage_users") || can("view_team_data"),
  });

  const queryTeams = useQuery({
    queryKey: ["team_memberships"],
    queryFn: loadTeamMemberships,
    enabled: can("manage_users") || can("view_team_data"),
  });

  if (queryUsers.isLoading || queryTeams.isLoading || datasetLoading) {
    return <LoadingState label="Loading team..." />;
  }

  if (queryUsers.error || queryTeams.error) {
    return <ErrorState message="Could not load team data." />;
  }

  const isSuperAdmin = can("manage_users");

  // Find which CHWs this user is supervising
  const teamMemberships = queryTeams.data ?? [];
  const supervisedCswIds = isSuperAdmin
    ? teamMemberships.map((t) => t.csw_id) // Admin sees all assigned
    : teamMemberships
        .filter((t) => t.supervisor_id === user?.id && t.status === "active")
        .map((t) => t.csw_id);

  const teamMembers = (queryUsers.data ?? []).filter((u) =>
    supervisedCswIds.includes(u.profile.id),
  );

  // If Admin, also group by supervisor or show a generic view. For simplicity, just list all CHWs or Supervisors.
  // Actually, for Admin, let's just list all CHWs that have a supervisor.

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={isSuperAdmin ? "All Teams" : "My Team"}
        subtitle={
          isSuperAdmin
            ? "Monitor all assigned Community Health Workers"
            : "Monitor and manage your Community Health Workers"
        }
      />

      {teamMembers.length === 0 ? (
        <EmptyState
          title="No CHWs Assigned"
          description={
            isSuperAdmin
              ? "No CHWs have been assigned to supervisors yet."
              : "You do not have any CHWs assigned to you."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map((chw) => {
            // Compute stats from dataset for this CHW
            const chwHouses = (dataset?.houses ?? []).filter(
              (h) => (h.house.data as Record<string, any>)?.["uploaded_by"] === chw.profile.id,
            );
            const chwMembers = (dataset?.members ?? []).filter(
              (m) => m.houseUuid && chwHouses.some((h) => h.house.id === m.houseUuid),
            );
            const chwAssessments = (dataset?.members ?? []).filter(
              (m) => m.screenedAt && m.assessment?.assessed_by === chw.profile.id,
            );
            const highRiskCount = chwMembers.filter((m) => m.risk === "high").length;

            // Find who their supervisor is (if admin viewing)
            const membership = teamMemberships.find((t) => t.csw_id === chw.profile.id);
            const supervisorName =
              isSuperAdmin && membership
                ? (queryUsers.data ?? []).find((u) => u.profile.id === membership.supervisor_id)
                    ?.profile.full_name
                : null;

            return (
              <div
                key={chw.profile.id}
                className="card-surface flex flex-col p-4 rounded-2xl shadow-xs border border-border/70 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 border-b border-border/50 pb-3 mb-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-foreground truncate">
                      {chw.profile.full_name || chw.profile.username}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {isSuperAdmin && supervisorName
                        ? `Sup: ${supervisorName}`
                        : "Community Health Worker"}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Stat label="Houses" value={chwHouses.length} icon={Home} />
                  <Stat label="Members" value={chwMembers.length} icon={Users} />
                  <Stat label="Assessments" value={chwAssessments.length} icon={Activity} />
                  <Stat
                    label="High Risk"
                    value={highRiskCount}
                    icon={ShieldAlert}
                    valueClass={highRiskCount > 0 ? "text-destructive" : ""}
                  />
                </div>

                <div className="mt-auto pt-2 border-t border-border/50">
                  <Link
                    to="/analytics"
                    className="flex items-center justify-center w-full gap-2 text-sm font-semibold text-primary py-2 hover:bg-primary-soft rounded-xl transition-colors"
                  >
                    View Performance <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: number;
  icon: any;
  valueClass?: string;
}) {
  return (
    <div className="bg-surface-muted p-2.5 rounded-xl border border-border/50 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] uppercase font-semibold tracking-wide">{label}</span>
      </div>
      <span className={`font-display font-bold text-lg ${valueClass || "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
