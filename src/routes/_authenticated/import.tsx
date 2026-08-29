import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, UploadCloud, UserCheck, History } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { tables } from "@/config/database";
import { importConfig } from "@/config/importing";
import { roleLabels, type AppRole } from "@/config/roles";
import { supabase } from "@/db/client";
import type { Profile } from "@/db/types";
import { useAuth } from "@/hooks/useAuth";
import { useRefreshDataset } from "@/hooks/useDataset";
import { cn } from "@/lib/utils";
import {
  buildPreview,
  commitImport,
  extractHeaders,
  type ImportPreview,
} from "@/services/importService";
import { ImportHistory } from "@/components/import/ImportHistory";

export const Route = createFileRoute("/_authenticated/import")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Smart Import — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Upload Excel or CSV files, auto-map columns, detect duplicate people across files and merge safely with a full preview.",
      },
      { property: "og:title", content: "Smart Import — Management App" },
      {
        property: "og:description",
        content: "Multi-file Excel and CSV import with duplicate detection and merge preview.",
      },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { user, role, can, isAdmin } = useAuth();
  const refresh = useRefreshDataset();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [mappingState, setMappingState] = useState<{
    unmapped: string[];
    suggestedMapping: Record<string, string>;
    allHeaders: string[];
  } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "insert" | "merge">>({});
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    batch?: number;
    totalBatches?: number;
  } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Load team members for assignment (admins can see all; supervisors see their CSWs)
  const teamQuery = useQuery({
    queryKey: ["team-members-for-import", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      if (isAdmin) {
        const [{ data: profiles }, { data: roleRows }] = await Promise.all([
          supabase.from(tables.profiles).select("*").order("full_name"),
          supabase.from(tables.userRoles).select("user_id, role"),
        ]);
        const roleMap = new Map<string, AppRole[]>();
        (roleRows ?? []).forEach((r) => {
          const row = r as { user_id: string | null; role: AppRole };
          if (!row.user_id) return;
          roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role]);
        });
        return ((profiles ?? []) as Profile[]).flatMap((p) => {
          const roles = roleMap.get(p.id) ?? [];
          const displayRole = (["supervisor", "survey_user"] as AppRole[]).find((r) =>
            roles.includes(r),
          );
          if (!displayRole) return [];
          return [{ profile: p, role: displayRole }];
        });
      }

      if (role === "supervisor") {
        const { data: memberships } = await supabase
          .from(tables.teamMemberships)
          .select("csw_id")
          .eq("supervisor_id", user.id)
          .eq("status", "active");
        const cswIds = (memberships ?? []).map((m) => (m as { csw_id: string }).csw_id);
        if (!cswIds.length) return [];
        const { data: profiles } = await supabase
          .from(tables.profiles)
          .select("*")
          .in("id", cswIds);
        return ((profiles ?? []) as Profile[]).map((p) => ({
          profile: p,
          role: "survey_user" as AppRole,
        }));
      }

      return [{ profile: user.profile!, role: role! }];
    },
    enabled: can("import_data") && Boolean(user?.id),
  });

  const extract = useMutation({
    mutationFn: (files: File[]) => extractHeaders(files),
    onSuccess: (result, files) => {
      if (result.unmappedHeaders.length > 0) {
        setPendingFiles(files);
        setMappingState({
          unmapped: result.unmappedHeaders,
          suggestedMapping: result.suggestedMapping,
          allHeaders: result.allHeaders
        });
      } else {
        analyse.mutate({ files, customMapping: {} });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read those files."),
  });

  const analyse = useMutation({
    mutationFn: ({ files, customMapping }: { files: File[]; customMapping: Record<string, string> }) => buildPreview(files, customMapping),
    onSuccess: (result) => {
      setPendingFiles(null);
      setMappingState(null);
      setPreview(result);
      setDecisions({});
      if (role === "survey_user" && user?.id) {
        setAssignedTo(user.id);
      }
      toast.success(`${result.totals.rows} rows analysed across ${result.files.length} file(s).`);
      if (result.totals.invalidCoordinates > 0) {
        toast.warning(
          `${result.totals.invalidCoordinates} house(s) have invalid coordinates and will be imported without a map pin.`,
        );
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build preview."),
  });

  const commit = useMutation({
    mutationFn: () => {
      const ac = new AbortController();
      setAbortController(ac);
      const assignee = teamMembers.find(m => m.profile.id === assignedTo);
      const assignedToName = assignee ? (assignee.profile.full_name ?? assignee.profile.username) : null;
      return commitImport(preview!, { 
        decisions, 
        assignedTo, 
        assignedToName, 
        supervisorId,
        onProgress: setImportProgress,
        signal: ac.signal
      });
    },
    onSuccess: (batch) => {
      toast.success(
        `Imported ${batch.houses_added ?? 0} new houses, ${batch.members_added ?? 0} new members.`,
      );
      setPreview(null);
      setAssignedTo(null);
      setSupervisorId(null);
      setImportProgress(null);
      void refresh();
    },
    onError: (e) => {
      setImportProgress(null);
      toast.error(e instanceof Error ? e.message : "Import failed.")
    },
  });

  if (!can("import_data"))
    return (
      <EmptyState
        title="Import is restricted"
        description="Ask an administrator or supervisor to import data for your area."
      />
    );

  const teamMembers = teamQuery.data ?? [];
  const supervisors = teamMembers.filter((m) => m.role === "supervisor");
  const csws = teamMembers.filter((m) => m.role === "survey_user");

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start gap-4">
        <PageHeader
          title="Smart Import"
          subtitle="Excel and CSV, multiple files at once. Nothing is written until you approve the preview."
        />
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm">
                <History className="size-4 mr-2" /> History
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Import History</SheetTitle>
              </SheetHeader>
              <ImportHistory />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div
        className="card-surface flex flex-col items-center gap-3 border-dashed p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = [...e.dataTransfer.files].slice(0, importConfig.maxFiles);
          if (files.length) extract.mutate(files);
        }}
      >
        <UploadCloud className="size-8 text-primary" />
        <div>
          <p className="font-display text-base font-semibold">Drop files here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {importConfig.acceptedExtensions.join(" · ")} • up to {importConfig.maxFiles} files
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={importConfig.acceptedExtensions.join(",")}
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])].slice(0, importConfig.maxFiles);
            if (files.length) extract.mutate(files);
            e.target.value = "";
          }}
        />
        <Button className="rounded-xl shadow-sm hover:shadow transition-all" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
      </div>

      {(extract.isPending || analyse.isPending) ? <LoadingState label="Analysing files and matching identities…" /> : null}

      {mappingState ? (
        <div className="card-surface p-4 border border-amber-200 bg-amber-50/30">
          <h3 className="font-display text-base font-semibold text-amber-800">Map Columns</h3>
          <p className="text-sm text-amber-800/80 mt-1 mb-4">
            Some columns from your file were not automatically recognized. Please map them to the correct internal fields, or leave them as "Skip" to import them as dynamic extra data.
          </p>
          <div className="grid gap-3 mb-6">
            {mappingState.unmapped.map((header) => (
              <div key={header} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-white/50 backdrop-blur-sm rounded-xl border border-amber-200/50">
                <span className="font-medium text-sm">{header}</span>
                <select
                  className="rounded-lg border border-amber-200 p-2 text-sm bg-white w-full sm:w-64"
                  value={mappingState.suggestedMapping[header] || ""}
                  onChange={(e) => {
                    setMappingState({
                      ...mappingState,
                      suggestedMapping: {
                        ...mappingState.suggestedMapping,
                        [header]: e.target.value
                      }
                    });
                  }}
                >
                  <option value="">-- Skip (Import as Extra) --</option>
                  {Object.keys(importConfig.aliases).map(canonical => (
                    <option key={canonical} value={canonical}>{canonical}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              className="rounded-xl shadow-sm"
              onClick={() => {
                if (pendingFiles) {
                  analyse.mutate({ files: pendingFiles, customMapping: mappingState.suggestedMapping });
                }
              }}
            >
              Confirm Mapping & Preview
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => {
              setMappingState(null);
              setPendingFiles(null);
            }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {preview && !mappingState ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Rows" value={preview.totals.rows} />
            <Metric
              label="Houses"
              value={`${preview.totals.housesNew} new / ${preview.totals.housesExisting} existing`}
            />
            <Metric
              label="Members"
              value={`${preview.totals.membersNew} new / ${preview.totals.membersMerged} merged`}
            />
            <Metric label="Needs review" value={preview.totals.possibleMatches} />
          </div>

          {preview.totals.invalidCoordinates > 0 ? (
            <div className="card-surface border border-risk-moderate p-4">
              <p className="text-sm font-medium text-risk-moderate">
                ⚠ {preview.totals.invalidCoordinates} house(s) with invalid coordinates
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Coordinates out of valid range (lat -90..90, lng -180..180) will NOT be stored.
                These houses will be imported without a map pin and flagged as unmapped.
              </p>
            </div>
          ) : null}

          {preview.newFields.length ? (
            <div className="card-surface p-4 border border-blue-200 bg-blue-50/30">
              <p className="text-sm font-medium text-blue-900">New dynamic fields detected ({preview.newFields.length})</p>
              <p className="mt-1 text-xs text-blue-800/70">
                These fields were not mapped to standard profiles but will be dynamically stored and automatically become available in Analytics and Data Quality reports.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {preview.newFields.map((f, i) => (
                  <span key={i} className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {preview.duplicateRows ? (
            <div className="card-surface p-4 border border-green-200 bg-green-50/30">
              <p className="text-sm font-medium text-green-900">
                {preview.duplicateRows} duplicate rows merged inside this upload
              </p>
              <p className="mt-1 text-xs text-green-800/70">
                Same person appearing in more than one file was combined instead of duplicated.
              </p>
            </div>
          ) : null}

          <section className="card-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="size-4 text-primary" />
              <p className="text-sm font-medium">Assign Data To</p>
            </div>
            {role === "survey_user" ? (
              <p className="text-xs text-muted-foreground">
                Data will be assigned to you: {user?.profile?.full_name ?? user?.userId}
              </p>
            ) : teamQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading team…</p>
            ) : (
              <div className="space-y-4">
                {csws.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      CHW ({roleLabels["survey_user"]})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setAssignedTo(null)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          assignedTo === null
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-surface text-muted-foreground hover:bg-surface-muted",
                        )}
                      >
                        Unassigned
                      </button>
                      {csws.map((c) => (
                        <button
                          key={c.profile.id}
                          onClick={() => setAssignedTo(c.profile.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            assignedTo === c.profile.id
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-surface text-muted-foreground hover:bg-surface-muted",
                          )}
                        >
                          {c.profile.full_name ?? c.profile.username}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No CHWs available — data will be imported without assignment.
                  </p>
                )}
              </div>
            )}
          </section>

          {preview.totals.possibleMatches ? (
            <section className="card-surface p-4 border border-amber-200">
              <p className="text-sm font-semibold text-amber-800">Possible same person — choose an action</p>
              <div className="mt-3 grid gap-2">
                {preview.houses.flatMap((h) =>
                  h.members
                    .filter((m) => m.action === "review")
                    .map((m) => (
                      <div
                        key={m.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/50 border border-amber-100 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {Math.round(m.matchConfidence * 100)}% match • {m.matchReason}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {(["merge", "insert"] as const).map((choice) => (
                            <button
                              key={choice}
                              onClick={() => setDecisions((d) => ({ ...d, [m.key]: choice }))}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                (decisions[m.key] ?? "insert") === choice
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-amber-200 bg-white text-muted-foreground hover:bg-amber-50",
                              )}
                            >
                              {choice === "merge" ? "Same person" : "New person"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )),
                )}
              </div>
            </section>
          ) : null}

          {preview.conflicts.length ? (
            <section className="card-surface p-4">
              <p className="text-sm font-medium">Conflicts logged ({preview.conflicts.length})</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Existing values are kept and every conflict is saved for review — nothing is
                overwritten silently.
              </p>
              <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
                {preview.conflicts.slice(0, 50).map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.label}</span> · {c.field}:{" "}
                    <span className="line-through opacity-70">{c.existingValue}</span> → <span className="text-green-600 font-medium">{c.newValue}</span> ({c.sourceFile})
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 sticky bottom-4 z-10 p-4 bg-white/80 backdrop-blur-md rounded-2xl border shadow-sm mt-8">
            {!importProgress && (
              <>
                <Button
                  className="rounded-xl shadow-sm w-full sm:w-auto"
                  disabled={commit.isPending}
                  onClick={() => commit.mutate()}
                >
                  Approve and import
                </Button>
                <Button variant="secondary" className="rounded-xl w-full sm:w-auto" onClick={() => setPreview(null)} disabled={commit.isPending}>
                  Discard preview
                </Button>
              </>
            )}
            
            {importProgress && (
              <div className="w-full">
                <div className="flex justify-between items-center text-sm font-medium mb-2 text-primary">
                  <div className="flex gap-2 items-center">
                    <span>{importProgress.stage}</span>
                    {importProgress.batch ? 
                      <span>Batch {importProgress.batch} of {importProgress.totalBatches}</span> 
                      : 
                      <span>{importProgress.current} / {importProgress.total}</span>
                    }
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => abortController?.abort()}
                    className="h-7 text-xs px-3 rounded-lg"
                  >
                    Cancel Import
                  </Button>
                </div>
                <div className="w-full bg-primary/10 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max(5, (importProgress.current / Math.max(1, importProgress.total)) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-primary/70 mt-2 text-center animate-pulse">
                  Processing backend chunk in background. Do not close this page.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="hidden md:block pt-8 border-t">
        <h2 className="mb-4 font-display text-lg font-semibold flex items-center gap-2">
          <History className="size-5 text-primary" /> Import history
        </h2>
        <ImportHistory />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
