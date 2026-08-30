import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingState, ErrorState } from "@/components/common/EmptyState";
import { Activity, Search, Users, ShieldCheck, UserCheck, Clock, Stethoscope } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { RiskBadge } from "@/components/common/RiskBadge";

export const Route = createFileRoute("/_authenticated/assessments")({
  component: AssessmentsIndexPage,
});

function AssessmentsIndexPage() {
  const { can } = useAuth();
  const { data, isLoading, error } = useDataset();
  const [searchQuery, setSearchQuery] = useState("");

  if (!can("perform_assessment")) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-4">
        <EmptyState
          title="Access Denied"
          description="Only Community Health Workers can record assessments."
        />
      </div>
    );
  }

  if (isLoading) return <LoadingState label="Loading members..." />;
  if (error || !data) return <ErrorState message="Could not load members" />;

  const filteredMembers = data.members.filter(
    (m) =>
      m.eligible &&
      (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.memberId.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const pending = filteredMembers.filter((m) => !m.screenedAt);
  const completed = filteredMembers
    .filter((m) => m.screenedAt)
    .sort((a, b) => new Date(b.screenedAt!).getTime() - new Date(a.screenedAt!).getTime());

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Assessments"
        subtitle="Find eligible members and record health screenings."
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-9 h-12 rounded-xl border-border/70 shadow-xs bg-surface"
          placeholder="Search by name or member ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-amber-500" />
          <h2 className="font-display font-semibold text-base text-foreground">
            Pending Screenings ({pending.length})
          </h2>
        </div>

        {pending.length === 0 ? (
          <div className="card-surface p-6 rounded-2xl border border-border/70 text-center">
            <UserCheck className="size-8 text-emerald-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No pending assessments for eligible members.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {pending.slice(0, 20).map((member) => (
              <Link
                key={member.id}
                to="/assessments/$memberId"
                params={{ memberId: member.id }}
                className="card-surface p-4 rounded-2xl border border-border/70 flex items-center justify-between transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="font-bold text-sm text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {member.memberId} • Age {member.age}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={member.risk} />
                  <Button size="sm" className="rounded-xl h-8 px-3">
                    Assess
                  </Button>
                </div>
              </Link>
            ))}
            {pending.length > 20 && (
              <p className="text-center text-xs text-muted-foreground py-2">
                And {pending.length - 20} more... Use search to find specific members.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-500" />
          <h2 className="font-display font-semibold text-base text-foreground">
            Recent Assessments ({completed.length})
          </h2>
        </div>

        {completed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No completed assessments yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {completed.slice(0, 10).map((member) => (
              <Link
                key={member.id}
                to="/assessments/$memberId"
                params={{ memberId: member.id }}
                className="card-surface p-4 rounded-2xl border border-border/70 flex items-center justify-between transition-colors hover:border-primary/50 opacity-80 hover:opacity-100"
              >
                <div>
                  <p className="font-bold text-sm text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Screened {new Date(member.screenedAt!).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={member.risk} />
                  <Button size="sm" variant="secondary" className="rounded-xl h-8 px-3">
                    View
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
