import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileSpreadsheet, Trash2, ArrowRightLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { EmptyState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/db/client";
import { tables } from "@/config/database";
import { useAuth } from "@/hooks/useAuth";
import { useRefreshDataset } from "@/hooks/useDataset";
import { deleteImportBatch } from "@/services/importBackendService";
import { cn } from "@/lib/utils";

export function ImportHistory() {
  const { can, isAdmin, role } = useAuth();
  const refresh = useRefreshDataset();
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [isTransferring, setIsTransferring] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState<any | null>(null);

  const batches = useQuery({
    queryKey: ["import-batches-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tables.importBatches)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const removeBatch = useMutation({
    mutationFn: async (batch: any) => {
      await deleteImportBatch({ data: { batchId: batch.id } });
    },
    onSuccess: () => {
      toast.success("Import deleted successfully.");
      batches.refetch();
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete import."),
  });

  const canDelete = isAdmin || role === "supervisor" || role === "survey_user";
  const canTransfer = isAdmin || role === "supervisor";

  const transferBatch = useMutation({
    mutationFn: async ({ batchId, assigneeId }: { batchId: string; assigneeId: string | null }) => {
      const { transferImportBatch } = await import("@/services/importBackendService");
      await transferImportBatch({ data: { batchId, newAssigneeId: assigneeId } });
    },
    onSuccess: () => {
      toast.success("Import transferred successfully.");
      setIsTransferring(null);
      batches.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to transfer import."),
  });

  const isLoading = batches.isLoading;
  const isEmpty = (batches.data ?? []).length === 0;

  return (
    <div className="grid gap-3 mt-4">
      {isLoading ? (
        <LoadingState label="Loading history…" />
      ) : isEmpty ? (
        <EmptyState title="No imports yet" description="Your first upload will appear here." />
      ) : (
        <>
          {(batches.data ?? []).map((b) => (
            <div
              key={b.id}
              className={cn(
                "card-surface p-4 flex flex-col gap-3 relative overflow-hidden group",
                b.status === "deleted" && "opacity-80 bg-surface/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "flex items-center gap-2 truncate text-sm font-semibold",
                      b.status === "deleted" &&
                        "line-through decoration-red-500 decoration-2 text-muted-foreground",
                    )}
                  >
                    <FileSpreadsheet
                      className={cn(
                        "size-4",
                        b.status === "deleted" ? "text-muted-foreground" : "text-primary",
                      )}
                    />
                    {Array.isArray(b.file_names) ? b.file_names.join(", ") : "Import"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {b.created_at
                        ? format(new Date(b.created_at), "MMM d, yyyy h:mm a")
                        : "Unknown date"}
                    </span>
                    <span>•</span>
                    <span>By {b.uploaded_by_name || "Unknown"}</span>
                    {b.assigned_to_name && (
                      <>
                        <span>•</span>
                        <span className="text-primary font-medium">
                          Assigned to {b.assigned_to_name}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full",
                        b.status === "deleted"
                          ? "bg-surface-muted/50 line-through decoration-red-500 decoration-2 text-muted-foreground"
                          : "bg-surface-muted",
                      )}
                    >
                      {b.total_rows ?? 0} rows
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full",
                        b.status === "deleted"
                          ? "bg-surface-muted/50 line-through decoration-red-500 decoration-2 text-muted-foreground"
                          : "bg-green-500/10 text-green-700",
                      )}
                    >
                      {b.houses_added ?? 0} houses
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full",
                        b.status === "deleted"
                          ? "bg-surface-muted/50 line-through decoration-red-500 decoration-2 text-muted-foreground"
                          : "bg-blue-500/10 text-blue-700",
                      )}
                    >
                      {b.members_added ?? 0} members
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full",
                        b.status === "deleted"
                          ? "bg-surface-muted/50 line-through decoration-red-500 decoration-2 text-muted-foreground"
                          : "bg-amber-500/10 text-amber-700",
                      )}
                    >
                      {b.merged_records ?? 0} merged
                    </span>
                    {(b.conflicts ?? 0) > 0 && (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full",
                          b.status === "deleted"
                            ? "bg-surface-muted/50 line-through decoration-red-500 decoration-2 text-muted-foreground"
                            : "bg-red-500/10 text-red-700",
                        )}
                      >
                        {b.conflicts} conflicts
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded",
                      b.status === "deleted"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-surface-muted text-muted-foreground",
                    )}
                  >
                    {b.status ?? "Unknown"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                {b.status !== "deleted" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => setSelectedBatch(b)}
                  >
                    <Eye className="size-3 mr-1.5" /> View Changes
                  </Button>
                )}

                <div className="flex-1" />

                {canTransfer && b.status !== "deleted" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => setIsTransferring(b.id)}
                  >
                    <ArrowRightLeft className="size-3 mr-1.5" /> Transfer
                  </Button>
                )}

                {canDelete && b.status !== "deleted" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setIsDeletingBatch(b)}
                  >
                    <Trash2 className="size-3 mr-1.5" /> Delete
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Dialog
            open={!!isDeletingBatch}
            onOpenChange={(open) => !open && !removeBatch.isPending && setIsDeletingBatch(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete Import?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="card-surface p-4 border border-destructive/20 bg-destructive/5 space-y-2">
                  <p>
                    <strong>File:</strong>{" "}
                    {Array.isArray(isDeletingBatch?.file_names)
                      ? isDeletingBatch?.file_names.join(", ")
                      : "Unknown"}
                  </p>
                  <p>
                    <strong>Imported:</strong>{" "}
                    {isDeletingBatch?.created_at
                      ? format(new Date(isDeletingBatch.created_at), "MMM d, yyyy h:mm a")
                      : "Unknown"}
                  </p>
                  <p>
                    <strong>Rows:</strong> {isDeletingBatch?.total_rows ?? 0}
                  </p>
                </div>

                <div className="space-y-2">
                  <p>This import created:</p>
                  <ul className="list-disc pl-5 font-medium">
                    <li>{isDeletingBatch?.houses_added ?? 0} Houses</li>
                    <li>{isDeletingBatch?.members_added ?? 0} Members</li>
                  </ul>

                  <p className="mt-2">It updated:</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>{isDeletingBatch?.houses_updated ?? 0} Existing Houses</li>
                  </ul>

                  <p className="mt-2">It merged:</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>{isDeletingBatch?.merged_records ?? 0} Existing Members</li>
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground mt-4 border-t pt-4">
                  <strong>Safety check:</strong> Only records created exclusively by this import
                  will be destructively removed. Unrelated historical data and merged/updated
                  records will simply lose this import as a source.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    disabled={removeBatch.isPending}
                    onClick={() => setIsDeletingBatch(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={removeBatch.isPending}
                    onClick={() => {
                      if (isDeletingBatch) removeBatch.mutate(isDeletingBatch);
                    }}
                  >
                    {removeBatch.isPending ? "Deleting..." : "Continue"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Import Changes</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                {selectedBatch && <BatchChangesViewer batch={selectedBatch} />}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!isTransferring} onOpenChange={(open) => !open && setIsTransferring(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Import</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select a new CHW or Supervisor to take ownership of all records in this import
                  batch.
                </p>
                <TransferForm
                  onTransfer={(assigneeId) => {
                    if (isTransferring) {
                      transferBatch.mutate({ batchId: isTransferring, assigneeId });
                    }
                  }}
                  isPending={transferBatch.isPending}
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function TransferForm({
  onTransfer,
  isPending,
}: {
  onTransfer: (id: string | null) => void;
  isPending: boolean;
}) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();

  const users = useQuery({
    queryKey: ["users-for-transfer"],
    queryFn: async () => {
      // Simplistic user fetch - in a real scenario, use existing team query from ImportPage
      const { data } = await supabase.from(tables.profiles).select("id, full_name, username");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <select
        className="w-full border rounded-lg p-2"
        value={selectedUser || ""}
        onChange={(e) => setSelectedUser(e.target.value)}
      >
        <option value="">-- Unassigned --</option>
        {(users.data ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name || u.username}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <Button disabled={isPending} onClick={() => onTransfer(selectedUser)}>
          {isPending ? "Transferring..." : "Confirm Transfer"}
        </Button>
      </div>
    </div>
  );
}

function BatchChangesViewer({ batch }: { batch: any }) {
  const conflicts = useQuery({
    queryKey: ["import-conflicts", batch.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tables.importConflicts)
        .select("*")
        .eq("batch_id", batch.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-muted p-3 rounded-xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">New Houses</p>
          <p className="font-display font-semibold text-xl">{batch.houses_added ?? 0}</p>
        </div>
        <div className="bg-surface-muted p-3 rounded-xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">New Members</p>
          <p className="font-display font-semibold text-xl">{batch.members_added ?? 0}</p>
        </div>
        <div className="bg-surface-muted p-3 rounded-xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Merged Records</p>
          <p className="font-display font-semibold text-xl">{batch.merged_records ?? 0}</p>
        </div>
        <div className="bg-surface-muted p-3 rounded-xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Data Conflicts</p>
          <p className="font-display font-semibold text-xl text-amber-600">
            {batch.conflicts ?? 0}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Value Changes (Old vs New)</h3>
        {conflicts.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading changes...</p>
        ) : (conflicts.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground bg-surface-muted p-4 rounded-xl text-center">
            No conflicts or overwrites logged for this import.
          </p>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Record</th>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium text-destructive">Old Value</th>
                    <th className="px-3 py-2 font-medium text-green-600">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(conflicts.data ?? []).map((c: any) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 truncate max-w-[120px]">
                        {c.house_id} {c.member_ref ? `(Member)` : ""}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px]">{c.field}</td>
                      <td className="px-3 py-2 text-destructive/80 line-through truncate max-w-[150px]">
                        {c.existing_value || "—"}
                      </td>
                      <td className="px-3 py-2 text-green-700 font-medium truncate max-w-[150px]">
                        {c.new_value || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
