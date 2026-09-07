import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileSpreadsheet,
  UploadCloud,
  UserCheck,
  History,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { getImportJobStatus, cancelImportJob } from "@/services/importBackendService";
import { ImportHistory } from "@/components/import/ImportHistory";
import { OfflineSyncService } from "@/services/offlineSync";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";

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
        name: "description",
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
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);
  const [localProgress, setLocalProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    batch?: number;
    totalBatches?: number;
  } | null>(null);

  // Auto-Approval Toggle & Multi-Tier Queue
  const [autoApproval, setAutoApproval] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("NCD_IMPORT_AUTO_APPROVAL");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleAutoApproval = (enabled: boolean) => {
    setAutoApproval(enabled);
    localStorage.setItem("NCD_IMPORT_AUTO_APPROVAL", String(enabled));
    toast.info(`Auto-Approval is now ${enabled ? "enabled" : "disabled"}`);
  };

  // Self-heal existing Dexie sync queue on mount
  useEffect(() => {
    void OfflineSyncService.repairQueue();
  }, []);

  // Poll for active background import job
  const jobQuery = useQuery({
    queryKey: ["active-import-job", activeBatchId],
    queryFn: async () => {
      if (activeBatchId?.startsWith("local-")) {
        return {
          id: activeBatchId,
          status: "completed",
          processedRows: localProgress?.total || 0,
          housesAdded: 0,
          membersAdded: 0,
          membersMerged: 0,
          failedRows: 0,
          progressPercent: 100,
          currentStage: "completed",
          errorSummary: [],
        };
      }
      const res = await getImportJobStatus({ data: { batchId: activeBatchId || undefined } });
      return res.job;
    },
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job && (job.status === "processing" || job.status === "queued")) {
        return 1500;
      }
      return 5000;
    },
  });

  const activeJob: any = jobQuery.data;

  // React to job completion
  useEffect(() => {
    if (
      activeJob &&
      (activeJob.status === "completed" || activeJob.status === "completed_with_errors")
    ) {
      if (!hasNotifiedComplete && activeBatchId === activeJob.batchId) {
        setHasNotifiedComplete(true);
        toast.success(
          `Import completed! Added ${activeJob.housesAdded} houses, ${activeJob.membersAdded} members.`,
        );
        void refresh();
      }
    }
  }, [activeJob, hasNotifiedComplete, activeBatchId, refresh]);

  // Load team members for assignment
  // Load CHW members strictly for assignment (excluding admins/supervisors per Requirement 9)
  const teamQuery = useQuery({
    queryKey: ["chw-members-for-import", user?.id],
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
          if (p.is_active === false) return [];
          const roles = roleMap.get(p.id) ?? [];
          // Requirement 9: Show ONLY valid CHW / survey-user accounts
          if (!roles.includes("survey_user")) return [];
          return [{ profile: p, role: "survey_user" as AppRole }];
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
          .in("id", cswIds)
          .order("full_name");
        return ((profiles ?? []) as Profile[])
          .filter((p) => p.is_active !== false)
          .map((p) => ({
            profile: p,
            role: "survey_user" as AppRole,
          }));
      }

      if (role === "survey_user" && user.profile) {
        return [{ profile: user.profile, role: "survey_user" as AppRole }];
      }

      return [];
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
          allHeaders: result.allHeaders,
        });
      } else {
        analyse.mutate({ files, customMapping: {} });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read those files."),
  });

  const analyse = useMutation({
    mutationFn: ({
      files,
      customMapping,
    }: {
      files: File[];
      customMapping: Record<string, string>;
    }) => buildPreview(files, customMapping),
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
    mutationFn: async () => {
      const assignee = teamMembers.find((m) => m.profile.id === assignedTo);
      const assignedToName = assignee
        ? (assignee.profile.full_name ?? assignee.profile.username)
        : null;

      const res = await commitImport(preview!, {
        decisions,
        assignedTo,
        assignedToName,
        onProgress: (p: any) => setLocalProgress(p),
      });

      return res;
    },
    onSuccess: (res) => {
      setActiveBatchId(res.batchId);
      setHasNotifiedComplete(false);
      setPreview(null);
      setAssignedTo(null);
      setSupervisorId(null);
      setLocalProgress(null);
      toast.success("Import completed successfully!", {
        duration: 5000,
      });
      jobQuery.refetch();
      void refresh();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to complete import.");
      setLocalProgress(null);
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (batchId: string) => {
      await cancelImportJob({ data: { batchId } });
    },
    onSuccess: () => {
      toast.info("Import cancellation requested.");
      jobQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to cancel import."),
  });

  if (!can("import_data"))
    return (
      <EmptyState
        title="Import is restricted"
        description="Ask an administrator or supervisor to import data for your area."
      />
    );

  const teamMembers = teamQuery.data ?? [];
  const csws = teamMembers.filter((m) => m.role === "survey_user");

  const isJobRunning =
    commit.isPending ||
    (activeJob && (activeJob.status === "processing" || activeJob.status === "queued"));

  const displayProgressPercent = localProgress
    ? Math.min(99, Math.round((localProgress.current / Math.max(1, localProgress.total)) * 100))
    : activeJob?.progressPercent || 0;

  const displayStage = localProgress?.stage || activeJob?.currentStage || "Processing records...";
  const displayProcessed = localProgress?.current || activeJob?.processedRows || 0;
  const displayTotal = localProgress?.total || activeJob?.totalRows || 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <PageHeader
            title="Smart Import"
            subtitle="Excel and CSV, multiple files at once. Auto-maps columns, detects duplicates and merges safely."
          />
          <div className="hidden sm:block">
            <RoleSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto bg-surface p-2 px-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-foreground">Auto-Approval</span>
            <span className="text-[10px] text-muted-foreground">
              {autoApproval ? "Active (Trusted Ingestion)" : "Manual Review Required"}
            </span>
          </div>
          <Switch checked={autoApproval} onCheckedChange={toggleAutoApproval} />
        </div>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
          <TabsTrigger value="upload">
            <UploadCloud className="size-4 mr-2" /> Upload & Map
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <Clock className="size-4 mr-2" /> Approval Queue
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4 mr-2" /> History
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: UPLOAD & MAP */}
        <TabsContent value="upload" className="space-y-5 mt-0">
          {/* ============================================================== */}
          {/*  ACTIVE IMPORT JOB BANNER                           */}
          {/* ============================================================== */}
          {isJobRunning && (
            <div className="card-surface p-5 rounded-2xl border-2 border-primary/30 bg-primary-soft/40 shadow-card space-y-4 animate-in fade-in duration-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-base text-foreground">
                        Import in Progress
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{displayStage}</p>
                  </div>
                </div>

                {activeJob?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelJobMutation.mutate(activeJob.id)}
                    disabled={cancelJobMutation.isPending}
                    className="text-xs rounded-xl h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    Cancel Import
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>Progress: {displayProgressPercent}%</span>
                  <span>
                    {displayProcessed} / {displayTotal} rows
                  </span>
                </div>
                <div className="w-full bg-primary/10 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, displayProgressPercent)}%` }}
                  />
                </div>
              </div>

              {activeJob && !commit.isPending && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-center">
                  <div className="p-2 rounded-xl bg-card/60">
                    <p className="text-[10px] text-muted-foreground font-semibold">Houses Added</p>
                    <p className="text-sm font-bold text-foreground">{activeJob.housesAdded}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-card/60">
                    <p className="text-[10px] text-muted-foreground font-semibold">Members Added</p>
                    <p className="text-sm font-bold text-emerald-600">{activeJob.membersAdded}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-card/60">
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Members Merged
                    </p>
                    <p className="text-sm font-bold text-amber-600">{activeJob.membersMerged}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-card/60">
                    <p className="text-[10px] text-muted-foreground font-semibold">Errors</p>
                    <p className="text-sm font-bold text-red-600">{activeJob.failedRows}</p>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-primary/80 font-medium bg-card/80 p-2.5 rounded-xl text-center">
                ✨ This import is processing in chunks. Please do not close the window until
                complete.
              </p>
            </div>
          )}

          {/* ============================================================== */}
          {/*  RECENTLY COMPLETED SUMMARY BANNER                             */}
          {/* ============================================================== */}
          {!isJobRunning &&
            activeJob &&
            (activeJob.status === "completed" || activeJob.status === "completed_with_errors") &&
            activeBatchId === activeJob.id && (
              <div className="card-surface p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm space-y-3 animate-in fade-in duration-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-emerald-950">
                        Import Job Finished Successfully
                      </h3>
                      <p className="text-xs text-emerald-800/80">
                        Processed {activeJob.processedRows} rows • Added {activeJob.housesAdded}{" "}
                        houses, {activeJob.membersAdded} members ({activeJob.membersMerged} merged).
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveBatchId(null)}
                    className="text-xs h-7 text-emerald-800 hover:bg-emerald-100"
                  >
                    Dismiss
                  </Button>
                </div>

                {activeJob.errorSummary && activeJob.errorSummary.length > 0 && (
                  <div className="pt-2 border-t border-emerald-200/60">
                    <button
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="text-xs font-semibold text-amber-800 hover:underline flex items-center gap-1"
                    >
                      <AlertTriangle className="size-3.5" />
                      <span>{activeJob.errorSummary.length} row(s) had warnings or issues</span>
                      {showErrorDetails ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>

                    {showErrorDetails && (
                      <div className="mt-2 p-3 rounded-xl bg-card border border-amber-200 max-h-48 overflow-y-auto space-y-1.5 text-xs text-muted-foreground">
                        {activeJob.errorSummary.map((err: any, idx: number) => (
                          <p key={idx}>
                            <span className="font-bold text-foreground">Row {err.row}:</span>{" "}
                            <span className="text-amber-700 font-medium">[{err.item}]</span> —{" "}
                            {err.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* ============================================================== */}
          {/*  DRAG AND DROP FILE UPLOAD AREA                                */}
          {/* ============================================================== */}
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
            <Button
              className="rounded-xl shadow-sm hover:shadow transition-all"
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </Button>
          </div>

          {extract.isPending || analyse.isPending ? (
            <LoadingState label="Analysing files and matching identities…" />
          ) : null}

          {/* ============================================================== */}
          {/*  COLUMN MAPPING UI                                             */}
          {/* ============================================================== */}
          {mappingState ? (
            <div className="card-surface p-4 border border-amber-200 bg-amber-50/30">
              <h3 className="font-display text-base font-semibold text-amber-800">Map Columns</h3>
              <p className="text-sm text-amber-800/80 mt-1 mb-4">
                Some columns from your file were not automatically recognized. Please map them to
                the correct internal fields, or leave them as "Skip" to import them as dynamic extra
                data.
              </p>
              <div className="grid gap-3 mb-6">
                {mappingState.unmapped.map((header) => (
                  <div
                    key={header}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-card/50 backdrop-blur-sm rounded-xl border border-amber-200/50"
                  >
                    <span className="font-medium text-sm">{header}</span>
                    <select
                      className="rounded-lg border border-amber-200 p-2 text-sm bg-card w-full sm:w-64"
                      value={mappingState.suggestedMapping[header] || ""}
                      onChange={(e) => {
                        setMappingState({
                          ...mappingState,
                          suggestedMapping: {
                            ...mappingState.suggestedMapping,
                            [header]: e.target.value,
                          },
                        });
                      }}
                    >
                      <option value="">-- Skip (Import as Extra) --</option>
                      {Object.keys(importConfig.aliases).map((canonical) => (
                        <option key={canonical} value={canonical}>
                          {canonical}
                        </option>
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
                      analyse.mutate({
                        files: pendingFiles,
                        customMapping: mappingState.suggestedMapping,
                      });
                    }
                  }}
                >
                  Confirm Mapping & Preview
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setMappingState(null);
                    setPendingFiles(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {/* ============================================================== */}
          {/*  IMPORT PREVIEW UI                                             */}
          {/* ============================================================== */}
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
                  <p className="text-sm font-medium text-blue-900">
                    New dynamic fields detected ({preview.newFields.length})
                  </p>
                  <p className="mt-1 text-xs text-blue-800/70">
                    These fields were not mapped to standard profiles but will be dynamically stored
                    and automatically become available in Analytics and Data Quality reports.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preview.newFields.map((f, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Assignment controls */}
              <div className="card-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Assign newly imported records</p>
                    <p className="text-xs text-muted-foreground">
                      Assign all imported houses to a specific CHW.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    className="w-full sm:w-48 h-9 rounded-xl border border-border/70 bg-card px-3 text-xs"
                    value={assignedTo || ""}
                    onChange={(e) => setAssignedTo(e.target.value || null)}
                  >
                    <option value="">-- Leave Unassigned --</option>
                    {csws.map((m) => (
                      <option key={m.profile.id} value={m.profile.id}>
                        {m.profile.full_name || m.profile.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conflicts */}
              {preview.conflicts.length ? (
                <section className="card-surface p-4">
                  <p className="text-sm font-medium">
                    Conflicts logged ({preview.conflicts.length})
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Existing values are kept and every conflict is saved for review — nothing is
                    overwritten silently.
                  </p>
                  <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
                    {preview.conflicts.slice(0, 50).map((c, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{c.label}</span> · {c.field}:{" "}
                        <span className="line-through opacity-70">{c.existingValue}</span> →{" "}
                        <span className="text-green-600 font-medium">{c.newValue}</span> (
                        {c.sourceFile})
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Bottom Action Bar */}
              <div className="flex flex-wrap gap-2 sticky bottom-4 z-10 p-4 bg-card/80 backdrop-blur-md rounded-2xl border shadow-sm mt-8">
                <Button
                  className="rounded-xl shadow-sm w-full sm:w-auto font-semibold"
                  disabled={commit.isPending}
                  onClick={() => commit.mutate()}
                >
                  {commit.isPending ? "Starting Background Import..." : "Approve and import"}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-xl w-full sm:w-auto"
                  onClick={() => setPreview(null)}
                  disabled={commit.isPending}
                >
                  Discard preview
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* TAB 2: APPROVAL QUEUE */}
        <TabsContent value="approvals" className="space-y-4 mt-0">
          <div className="card-surface p-6 rounded-2xl border border-border/70 space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-6 text-primary" />
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  Multi-Tier Import Approval Queue
                </h3>
                <p className="text-xs text-muted-foreground">
                  When Auto-Approval is disabled, field survey batch imports are held here for
                  administrative sign-off before committing to the live registry.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center">
            <Clock className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <h3 className="text-sm font-semibold text-foreground">Approval Queue Clean</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {autoApproval
                ? "Auto-Approval is currently ACTIVE. New imports process automatically."
                : "No imports currently pending supervisor sign-off."}
            </p>
          </div>
        </TabsContent>

        {/* TAB 3: HISTORY */}
        <TabsContent value="history" className="space-y-4 mt-0">
          <ImportHistory />
        </TabsContent>
      </Tabs>
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
