import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { tables } from "@/config/database";
import { roleLabels, type AppRole } from "@/config/roles";
import { supabase } from "@/db/client";
import type { Profile } from "@/db/types";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Users & Roles — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Team directory with database-backed roles for admins, supervisors and community health workers.",
      },
      { property: "og:title", content: "Users & Roles — Management App" },
      {
        property: "og:description",
        content: "Team directory with database-backed role assignments.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { can } = useAuth();

  const query = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
        await Promise.all([
          supabase.from(tables.profiles).select("*").order("created_at"),
          supabase.from(tables.userRoles).select("user_id, role"),
        ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const row = r as { user_id: string | null; role: AppRole };
        if (!row.user_id) return;
        roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role]);
      });
      return ((profiles ?? []) as Profile[]).map((p) => ({
        profile: p,
        roles: roleMap.get(p.id) ?? [],
      }));
    },
    enabled: can("manage_users"),
  });

  if (!can("manage_users"))
    return (
      <EmptyState
        title="Restricted"
        description="Only administrators can view the team directory."
      />
    );
  if (query.isLoading) return <LoadingState label="Loading team…" />;
  if (query.error)
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Unknown error"}
        onRetry={() => void query.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & Roles"
        subtitle="Roles are stored in the database and enforced by row-level security — never in the browser."
      />
      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <div className="grid gap-2">
          {(query.data ?? []).map(({ profile, roles }) => (
            <div key={profile.id} className="card-surface flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{profile.full_name ?? profile.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  User ID: {profile.username ?? "—"}
                  {profile.phone ? ` • ${profile.phone}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {roles.length ? (
                  roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
                    >
                      {roleLabels[role]}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No role</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
