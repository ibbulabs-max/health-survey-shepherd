import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tables } from "@/config/database";
import { roleLabels, type AppRole } from "@/config/roles";
import { supabase } from "@/db/client";
import type { Profile } from "@/db/types";
import { useAuth } from "@/hooks/useAuth";
import { createUserAdmin } from "@/services/adminService";
import { loadAllUsers } from "@/services/userService";

export const Route = createFileRoute("/_authenticated/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Users & Roles — Management App by Ibrahim Labs" },
      { name: "description", content: "Team directory with database-backed role assignments." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { can, user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // New User Form State
  const [newUserId, setNewUserId] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("survey_user");
  const [newSupervisorId, setNewSupervisorId] = useState<string>("");

  const query = useQuery({
    queryKey: ["users"],
    queryFn: loadAllUsers,
    enabled: can("manage_users"),
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!newUserId || !newFullName || !newRole) {
        throw new Error("User ID, Name, and Role are required.");
      }
      if (newRole === "survey_user" && !newSupervisorId) {
        throw new Error("CSW requires a Supervisor assignment.");
      }
      return createUserAdmin({
        data: {
          userId: newUserId,
          pin: "123456", // Default pin per requirements (user_metadata must_change_pin=true)
          fullName: newFullName,
          role: newRole,
          ...(newRole === "survey_user" && newSupervisorId
            ? { supervisorId: newSupervisorId }
            : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("User created successfully. Default PIN is 123456.");
      setIsDialogOpen(false);
      setNewUserId("");
      setNewFullName("");
      setNewRole("survey_user");
      setNewSupervisorId("");
      void query.refetch();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to create user.");
    },
  });

  if (!can("manage_users")) {
    return (
      <EmptyState
        title="Restricted"
        description="Only administrators can view the team directory."
      />
    );
  }

  if (query.isLoading) return <LoadingState label="Loading team…" />;
  if (query.error)
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Unknown error"}
        onRetry={() => void query.refetch()}
      />
    );

  const supervisors = (query.data ?? []).filter((u) => u.roles.includes("supervisor"));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Users & Roles"
          subtitle="Roles are stored in the database and enforced by row-level security."
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-sm">
              <Plus className="mr-2 size-4" /> New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullname">Full Name</Label>
                <Input
                  id="fullname"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Rahul Kumar"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userid">Login User ID (Unique)</Label>
                <Input
                  id="userid"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="e.g. rahul_k"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="survey_user">CSW / CHW</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRole === "survey_user" && (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <Label>Assign Supervisor</Label>
                  <Select value={newSupervisorId} onValueChange={setNewSupervisorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supervisor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map((s) => (
                        <SelectItem key={s.profile.id} value={s.profile.id}>
                          {s.profile.full_name ?? s.profile.username}
                        </SelectItem>
                      ))}
                      {supervisors.length === 0 && (
                        <SelectItem value="none" disabled>
                          No supervisors available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Required for CSW. Select the Supervisor who will manage this user.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={createUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createUserMutation.mutate()}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <div className="grid gap-2">
          {(query.data ?? []).map(({ profile, roles }) => (
            <div
              key={profile.id}
              className="card-surface flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{profile.full_name ?? profile.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  User ID: {profile.username ?? "—"}
                  {profile.phone ? ` • ${profile.phone}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5 items-center">
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

                <div className="ml-2 pl-2 border-l border-border/40">
                  <AdminUserActions
                    userId={profile.id}
                    currentRole={roles[0] ?? "none"}
                    userName={profile.full_name ?? profile.username ?? "Unknown"}
                    supervisors={supervisors.map((s) => ({
                      id: s.profile.id,
                      name: s.profile.full_name ?? s.profile.username ?? "Unknown",
                    }))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
