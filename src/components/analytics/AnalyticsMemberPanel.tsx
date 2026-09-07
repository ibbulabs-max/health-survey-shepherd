import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Search, SlidersHorizontal, Download, FileText, User } from "lucide-react";
import type { MemberView, HouseView } from "@/lib/domain";
import type { ActiveFilters } from "@/hooks/useAnalytics";
import { useDataset } from "@/hooks/useDataset";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
import { cn } from "@/lib/utils";

export interface AnalyticsMemberPanelProps {
  members: MemberView[];
  filters: ActiveFilters;
  onClearFilter: (key: keyof ActiveFilters) => void;
  onClearAll: () => void;
  onSearchChange: (query: string) => void;
  onClose?: () => void;
  className?: string;
}

const PAGE_SIZE = 15;

export function AnalyticsMemberPanel({
  members,
  filters,
  onClearFilter,
  onClearAll,
  onSearchChange,
  onClose,
  className,
}: AnalyticsMemberPanelProps) {
  const navigate = useNavigate();
  const { data } = useDataset();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedHouseForSheet, setSelectedHouseForSheet] = useState<HouseView | null>(null);

  // Active filter chips list
  const activeChips: { key: keyof ActiveFilters; label: string }[] = [];
  if (filters.age != null) activeChips.push({ key: "age", label: `Age: ${filters.age}` });
  if (filters.gender != null) activeChips.push({ key: "gender", label: `${filters.gender}` });
  if (filters.risk != null)
    activeChips.push({ key: "risk", label: `${filters.risk.toUpperCase()} Risk` });
  if (filters.bp != null) activeChips.push({ key: "bp", label: `BP: ${filters.bp}` });
  if (filters.sugar != null) activeChips.push({ key: "sugar", label: `Sugar: ${filters.sugar}` });
  if (filters.bmiCategory != null)
    activeChips.push({ key: "bmiCategory", label: `BMI: ${filters.bmiCategory}` });
  if (filters.condition != null)
    activeChips.push({ key: "condition", label: `${filters.condition}` });
  if (filters.lifestyleKey != null)
    activeChips.push({ key: "lifestyleKey", label: `${filters.lifestyleKey}` });
  if (filters.followUpStatus != null)
    activeChips.push({ key: "followUpStatus", label: `Follow-up: ${filters.followUpStatus}` });
  if (filters.referralStatus != null)
    activeChips.push({ key: "referralStatus", label: `Referral: ${filters.referralStatus}` });
  if (filters.assessmentStatus != null)
    activeChips.push({ key: "assessmentStatus", label: `${filters.assessmentStatus}` });
  if (filters.dataQuality != null)
    activeChips.push({ key: "dataQuality", label: `Issue: ${filters.dataQuality}` });

  // Pagination calculation
  const totalMembers = members.length;
  const paginatedMembers = members.slice(0, limit);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLimit((prev) => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget]);

  const handleExportCsv = () => {
    if (members.length === 0) return;
    const headers = [
      "Member Name",
      "Member ID",
      "House ID",
      "Age",
      "Gender",
      "Risk Level",
      "Systolic",
      "Diastolic",
      "Blood Sugar",
      "Conditions",
    ];
    const rows = members.map((m) => [
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.memberId}"`,
      `"${m.houseId ?? ""}"`,
      m.age ?? "",
      `"${m.gender ?? ""}"`,
      `"${m.risk}"`,
      m.systolic ?? "",
      m.diastolic ?? "",
      m.bloodSugar ?? "",
      `"${m.conditions.join("; ")}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_members_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenAssessment = () => {
    const targetMember = selectedMemberId
      ? members.find((m) => m.id === selectedMemberId)
      : members[0];
    if (targetMember) {
      void navigate({
        to: "/members/$memberId",
        params: { memberId: targetMember.id },
      });
    }
  };

  const handleOpenHouseSheet = (houseUuid: string | null) => {
    if (!houseUuid || !data) return;
    const house = data.byHouseUuid.get(houseUuid);
    if (house) {
      setSelectedHouseForSheet(house);
    }
  };

  return (
    <aside
      className={cn(
        "bg-surface rounded-2xl border border-border/70 shadow-xs flex flex-col h-full max-h-[860px] overflow-hidden transition-all",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-foreground">
          Member List{" "}
          {activeChips.length > 0 && (
            <span className="font-normal text-muted-foreground">({activeChips[0]?.label})</span>
          )}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="px-4 py-2.5 bg-surface-muted/40 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              Active Filters
            </span>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => onClearFilter(chip.key)}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-border/50 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search within filtered members…"
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-surface-muted/60 border border-border/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={members.length === 0}
          title="Export CSV"
          className="h-8 px-2.5 rounded-xl border border-border/60 bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-40"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>

        <button
          type="button"
          onClick={handleOpenAssessment}
          disabled={members.length === 0}
          className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-40 shadow-xs"
        >
          <FileText className="size-3.5" />
          <span>Profile</span>
        </button>
      </div>

      {/* Member Rows List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {paginatedMembers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-1">
            <p className="text-xs font-semibold">No members match this filter</p>
            <p className="text-[11px]">Try selecting another candle or clearing filters.</p>
          </div>
        ) : (
          paginatedMembers.map((m) => {
            const isSelected = selectedMemberId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
                className={cn(
                  "p-3 flex items-center justify-between gap-2 hover:bg-surface-muted/50 cursor-pointer transition-colors text-xs select-none",
                  isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                )}
              >
                {/* Left: Avatar & Identity */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
                    {m.name ? m.name[0]?.toUpperCase() : <User className="size-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-xs">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {m.memberId ?? "No MID"} •{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenHouseSheet(m.houseUuid);
                        }}
                        className="text-primary font-bold hover:underline"
                      >
                        {m.houseId ?? "View House"}
                      </button>
                    </p>
                  </div>
                </div>

                {/* Middle: Age & Gender */}
                <div className="text-right shrink-0 text-[11px] text-muted-foreground px-2">
                  <span className="font-medium text-foreground">{m.age ?? "?"}y</span> •{" "}
                  {m.gender ?? "—"}
                </div>

                {/* Right: Risk Badge & Vitals */}
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      m.risk === "high"
                        ? "bg-risk-high-soft text-risk-high"
                        : m.risk === "moderate"
                          ? "bg-risk-moderate-soft text-risk-moderate"
                          : "bg-risk-low-soft text-risk-low",
                    )}
                  >
                    {m.risk}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {m.systolic && m.diastolic ? `${m.systolic}/${m.diastolic}` : "No BP"}
                    {m.bloodSugar ? ` • ${m.bloodSugar}mg` : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {paginatedMembers.length < totalMembers ? (
          <div ref={observerTarget} className="p-3 text-center text-xs text-muted-foreground">
            Loading more members...
          </div>
        ) : totalMembers > 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground/60">
            End of list ({totalMembers} members)
          </div>
        ) : null}
      </div>

      {/* Unified Global House Detail Sheet */}
      <HouseDetailSheet
        house={selectedHouseForSheet}
        open={Boolean(selectedHouseForSheet)}
        onOpenChange={(open) => !open && setSelectedHouseForSheet(null)}
      />
    </aside>
  );
}
