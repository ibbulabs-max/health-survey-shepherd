import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { importConfig } from "@/config/importing";
import { useAuth } from "@/hooks/useAuth";
import { useRefreshDataset } from "@/hooks/useDataset";
import {
  buildPreview,
  commitImport,
  loadImportBatches,
  type ImportPreview,
} from "@/services/importService";
import { cn } from "@/lib/utils";

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
  const { can } = useAuth();
  const refresh = useRefreshDataset();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "insert" | "merge">>({});

  const batches = useQuery({ queryKey: ["import-batches"], queryFn: () => loadImportBatches() });

  const analyse = useMutation({
    mutationFn: (files: File[]) => buildPreview(files),
    onSuccess: (result) => {
      setPreview(result);
      setDecisions({});
      toast.success(`${result.totals.rows} rows analysed across ${result.files.length} file(s).`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read those files."),
  });

  const commit = useMutation({
    mutationFn: () => commitImport(preview!, { decisions }),
    onSuccess: (batch) => {
      toast.success(
        `Imported ${batch.houses_added ?? 0} new houses, ${batch.members_added ?? 0} new members.`,
      );
      setPreview(null);
      void refresh();
      void batches.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed."),
  });

  if (!can("import_data"))
    return (
      <EmptyState
        title="Import is restricted"
        description="Ask an administrator or supervisor to import data for your area."
      />
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Smart Import"
        subtitle="Excel and CSV, multiple files at once. Nothing is written until you approve the preview."
      />

      <div
        className="card-surface flex flex-col items-center gap-3 border-dashed p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = [...e.dataTransfer.files].slice(0, importConfig.maxFiles);
          if (files.length) analyse.mutate(files);
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
            if (files.length) analyse.mutate(files);
            e.target.value = "";
          }}
        />
        <Button className="rounded-xl" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
      </div>

      {analyse.isPending ? <LoadingState label="Analysing files and matching identities…" /> : null}

      {preview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Rows" value={preview.totals.rows} />
            <Metric label="Houses" value={`${preview.totals.housesNew} new / ${preview.totals.housesExisting} existing`} />
            <Metric label="Members" value={`${preview.totals.membersNew} new / ${preview.totals.membersMerged} merged`} />
            <Metric label="Needs review" value={preview.totals.possibleMatches} />
          </div>

          {preview.newFields.length ? (
            <div className="card-surface p-4">
              <p className="text-sm font-medium">New fields detected ({preview.newFields.length})</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kept exactly as provided and shown on member records: {preview.newFields.join(", ")}
              </p>
            </div>
          ) : null}

          {preview.duplicateRows ? (
            <div className="card-surface p-4">
              <p className="text-sm font-medium">
                {preview.duplicateRows} duplicate rows merged inside this upload
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Same person appearing in more than one file was combined instead of duplicated.
              </p>
            </div>
          ) : null}

          {preview.totals.possibleMatches ? (
            <section className="card-surface p-4">
              <p className="text-sm font-medium">Possible same person — choose an action</p>
              <div className="mt-3 grid gap-2">
                {preview.houses.flatMap((h) =>
                  h.members
                    .filter((m) => m.action === "review")
                    .map((m) => (
                      <div
                        key={m.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted p-3"
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
                                "rounded-full border px-3 py-1.5 text-xs font-medium",
                                (decisions[m.key] ?? "insert") === choice
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-surface text-muted-foreground",
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
                    {c.existingValue} → {c.newValue} ({c.sourceFile})
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-xl"
              disabled={commit.isPending}
              onClick={() => commit.mutate()}
            >
              {commit.isPending ? "Importing…" : "Approve and import"}
            </Button>
            <Button variant="secondary" className="rounded-xl" onClick={() => setPreview(null)}>
              Discard preview
            </Button>
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Import history</h2>
        {batches.isLoading ? (
          <LoadingState label="Loading history…" />
        ) : (batches.data ?? []).length === 0 ? (
          <EmptyState title="No imports yet" description="Your first upload will appear here." />
        ) : (
          <div className="grid gap-2">
            {(batches.data ?? []).map((b) => (
              <div key={b.id} className="card-surface flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <FileSpreadsheet className="size-4 text-primary" />
                    {Array.isArray(b.file_names) ? b.file_names.join(", ") : "Import"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {b.total_rows ?? 0} rows • {b.houses_added ?? 0} houses added •{" "}
                    {b.members_added ?? 0} members added • {b.merged_records ?? 0} merged •{" "}
                    {b.conflicts ?? 0} conflicts
                  </p>
                </div>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {b.status ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
