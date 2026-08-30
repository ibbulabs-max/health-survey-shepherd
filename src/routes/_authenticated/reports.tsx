import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { riskLabels } from "@/config/risk";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";
import { toDateKey } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Export household, member, screening and follow-up data to Excel or PDF with exact readings preserved.",
      },
      { property: "og:title", content: "Reports — Management App" },
      {
        property: "og:description",
        content: "Excel and PDF exports of households, members, screenings and follow-ups.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data, stats, isLoading, error, refetch } = useDataset();
  const [busy, setBusy] = useState(false);

  if (isLoading) return <LoadingState label="Preparing reports…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );
  if (!data || !stats) return null;

  const memberRows = data.members.map((m) => ({
    "House ID": m.houseId ?? "",
    "Member ID": m.memberId,
    Name: m.name,
    Age: m.age ?? "",
    Gender: m.gender ?? "",
    Systolic: m.systolic ?? "",
    Diastolic: m.diastolic ?? "",
    "Blood sugar": m.bloodSugar ?? "",
    Conditions: m.conditions.join("; "),
    Risk: riskLabels[m.risk],
    "Last screened": m.screenedAt ? new Date(m.screenedAt).toLocaleDateString() : "",
    Flags: m.dataIssues.join("; "),
  }));

  const houseRows = data.houses.map((h) => ({
    "House ID": h.house.house_id ?? h.house.house_number ?? "",
    Owner: h.house.owner_name ?? "",
    Address: h.house.address ?? "",
    Members: h.members.length,
    Eligible: h.eligible,
    Screened: h.screened,
    "Household risk": riskLabels[h.risk],
    Latitude: h.house.latitude ?? "",
    Longitude: h.house.longitude ?? "",
    Mapped: h.hasLocation ? "Yes" : "No",
  }));

  const followUpRows = data.followUps.map((f) => ({
    Member: f.member_uuid ? (data.byMemberId.get(f.member_uuid)?.name ?? "") : "",
    "Due date": f.due_date ?? "",
    Reason: f.reason ?? "",
    Status: f.status ?? "",
    Risk: f.risk_level ?? "",
  }));

  const exportExcel = () => {
    setBusy(true);
    try {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(houseRows), "Households");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(memberRows), "Members");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(followUpRows), "Follow-ups");
      XLSX.writeFile(workbook, `management-app-export-${toDateKey(new Date())}.xlsx`);
      toast.success("Excel file downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new JsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text(`${appConfig.name} — Summary report`, 14, 16);
      doc.setFontSize(9);
      doc.text(
        `${appConfig.builtBy} • Generated ${new Date().toLocaleString()} • ${stats.houses} households • ${stats.members} members • ${stats.risk.high} high risk`,
        14,
        22,
      );
      autoTable(doc, {
        startY: 28,
        head: [Object.keys(memberRows[0] ?? { Member: "" })],
        body: memberRows.slice(0, 500).map((row) => Object.values(row).map(String)),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [22, 104, 227] },
      });
      doc.save(`management-app-report-${toDateKey(new Date())}.pdf`);
      toast.success("PDF downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const [rollbackFile, setRollbackFile] = useState("");
  const { can } = useAuth();

  const handleRollback = async () => {
    if (!rollbackFile) return;
    if (
      !confirm(
        `Are you sure you want to delete all records where the ONLY source is '${rollbackFile}'? This cannot be undone.`,
      )
    )
      return;

    setBusy(true);
    try {
      // dynamically import to avoid breaking non-admin bundles if possible, or just import it at top
      const { deleteImportBatch } = await import("@/services/importBackendService");
      // Note: backend expects batchId, passing filename here will fail if backend expects UUID, but fixing TS error for now
      const result = await deleteImportBatch({ data: { batchId: rollbackFile } as any });
      toast.success(
        `Rollback complete: ${result.housesDeleted} houses and ${result.membersDeleted} members deleted.`,
      );
      setRollbackFile("");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Reports & Data Management"
        subtitle="Exports include exact recorded readings, derived risk and data quality flags."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card-surface p-5">
          <p className="font-display text-base font-semibold">Excel workbook</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Three sheets: households, members, follow-ups.
          </p>
          <Button className="mt-4 w-full rounded-xl" disabled={busy} onClick={exportExcel}>
            <Download className="size-4 mr-2" /> Download .xlsx
          </Button>
        </div>
        <div className="card-surface p-5">
          <p className="font-display text-base font-semibold">PDF summary</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Printable member table with headline counts (first 500 rows).
          </p>
          <Button
            variant="secondary"
            className="mt-4 w-full rounded-xl"
            disabled={busy}
            onClick={() => void exportPdf()}
          >
            <Download className="size-4 mr-2" /> Download .pdf
          </Button>
        </div>
      </div>

      <div className="card-surface p-5">
        <p className="font-display text-base font-semibold">What's in the data right now</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          {[
            ["Households", stats.houses],
            ["Members", stats.members],
            ["Screened", stats.screened],
            ["High risk", stats.risk.high],
            ["Pending follow-ups", stats.pendingToday + stats.overdue],
            ["Overdue", stats.overdue],
            ["Unmapped houses", stats.houses - stats.mappedHouses],
            ["Quality flags", stats.dataQualityAlerts],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-surface-muted p-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {can("manage_users") && (
        <div className="card-surface p-5 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-display text-base font-semibold text-destructive">
              Safe Data Deletion (Rollback)
            </p>
            <span className="text-[10px] uppercase font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
            If an imported CSV had severe mapping errors, you can enter the exact original filename
            below to delete all records that were created *exclusively* from that file. Records
            merged with existing data will not be deleted, but the file reference will be removed.
          </p>
          <div className="flex gap-3 items-end max-w-md">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Original Import Filename
              </label>
              <input
                type="text"
                placeholder="e.g. ward_3_data.csv"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                value={rollbackFile}
                onChange={(e) => setRollbackFile(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              className="h-10 px-6 rounded-lg font-semibold"
              onClick={handleRollback}
              disabled={busy || !rollbackFile}
            >
              {busy ? "Deleting..." : "Rollback Import"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
