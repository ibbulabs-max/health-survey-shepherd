import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
  MapPin,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Plus,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RiskLevel } from "@/config/risk";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/hooks/useSettings";
import { useUsers } from "@/hooks/useUsers";
import { getUserDisplayName } from "@/services/userService";
import { fetchHolidays } from "@/services/holidayService";
import { cn } from "@/lib/utils";
import { completeFollowUp, postponeFollowUp } from "@/services/followUpService";
import {
  daysDiff,
  extractMemberFollowUpSummary,
  formatDisplayDate,
  isEligibleForFollowUp,
  type MemberFollowUpSummary,
  toDateKeySafe,
} from "@/lib/followUpEngine";
import type { MemberView, HouseView } from "@/lib/domain";

import { FollowUpCard } from "@/components/followups/FollowUpCard";
import { FollowUpKpi } from "@/components/followups/FollowUpKpi";
import { FollowUpSkeleton } from "@/components/followups/FollowUpSkeleton";
import { MiniCalendarGrid } from "@/components/followups/MiniCalendarGrid";
import type { EnrichedFollowUpItem } from "@/components/followups/types";

export const Route = createFileRoute("/_authenticated/followups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — Health Survey Shepherd" },
      {
        name: "description",
        content:
          "Track and manage scheduled member follow-ups with calendar, filters, and risk-driven scheduling.",
      },
    ],
  }),
  component: FollowUpsPage,
});

/* -------------------------------------------------------------------------- */
/*                              Filter Types                                  */
/* -------------------------------------------------------------------------- */

type RiskFilter = "all" | "high" | "moderate" | "normal";
type StatusFilter = "all" | "today" | "upcoming" | "due" | "completed";

/* -------------------------------------------------------------------------- */
/*                              Page Component                                */
/* -------------------------------------------------------------------------- */

function FollowUpsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDataset();
  const refresh = useRefreshDataset();
  const { role, isAdmin, user } = useAuth();
  const isMobile = useIsMobile();
  const { data: users } = useUsers();

  // Settings
  const { minEligibleAge, followUpIntervals, dailyTarget, loadSettings, thresholds } =
    useSettings();
  const [holidaysSet, setHolidaysSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings(user?.userId, role ?? undefined, undefined);
    fetchHolidays()
      .then((hols) => setHolidaysSet(new Set(hols.map((h) => h.holiday_date))))
      .catch(console.error);
  }, [loadSettings, user?.userId, role]);

  const isCHW = role === "survey_user";
  const isSupervisor = role === "supervisor";

  /* -------- DUAL FILTER STATE (Level 1: Risk, Level 2: Status) ----------- */
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  /* -------- OTHER FILTER STATE ------------------------------------------- */
  const [searchQuery, setSearchQuery] = useState("");
  const [houseFilter, setHouseFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showFiltersBar, setShowFiltersBar] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  /* -------- CALENDAR STATE ----------------------------------------------- */
  const now = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKeySafe(now), [now]);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [showCalendarDrawer, setShowCalendarDrawer] = useState(false);

  /* -------- MODAL STATE -------------------------------------------------- */
  const [completeTarget, setCompleteTarget] = useState<EnrichedFollowUpItem | null>(null);
  const [completeSystolic, setCompleteSystolic] = useState("");
  const [completeDiastolic, setCompleteDiastolic] = useState("");
  const [completeSugar, setCompleteSugar] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");

  const [rescheduleTarget, setRescheduleTarget] = useState<EnrichedFollowUpItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Ctrl+K search focus shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* -------- USER MAP ----------------------------------------------------- */
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    if (users) {
      for (const u of users) {
        m.set(u.profile.id, getUserDisplayName(u));
      }
    }
    return m;
  }, [users]);

  /* -------- BUILD ALL FOLLOW-UP ITEMS ------------------------------------ */
  const allFollowUpItems = useMemo<EnrichedFollowUpItem[]>(() => {
    if (!data) return [];

    const items: EnrichedFollowUpItem[] = [];

    for (const member of data.members) {
      const house = member.houseUuid ? (data.byHouseUuid.get(member.houseUuid) ?? null) : null;
      const summary = extractMemberFollowUpSummary(
        member,
        member.assessment,
        data.followUps,
        minEligibleAge,
        followUpIntervals,
        holidaysSet,
        undefined,
        thresholds?.working_days,
      );

      const chwId = house?.house?.assigned_csw_id ?? null;
      const chwName = chwId ? (userMap.get(chwId) ?? null) : null;
      const diff = summary.nextFollowUpDate ? daysDiff(todayKey, summary.nextFollowUpDate) : 0;

      items.push({
        id: summary.activeFollowUpId ?? member.id,
        member,
        house,
        summary,
        assignedChwName: chwName,
        dueDate: summary.nextFollowUpDate,
        displayDueDate: summary.nextFollowUpDateFormatted,
        surveyDate: summary.surveyDate,
        displaySurveyDate: summary.surveyDateFormatted,
        status: summary.status,
        risk: member.risk,
        vitalsToCheck: summary.vitalsToCheck,
        daysDiffFromToday: diff,
      });
    }

    return items;
  }, [
    data,
    todayKey,
    userMap,
    minEligibleAge,
    followUpIntervals,
    holidaysSet,
    thresholds?.working_days,
  ]);

  const isSearching = searchQuery.trim().length > 0;

  /* -------- BASE FOLLOW-UPS (RBAC + Eligibility) ------------------------- */
  const baseFollowUps = useMemo(() => {
    let list = allFollowUpItems;

    // RBAC filtering
    if (!isAdmin && user) {
      if (isSupervisor) {
        list = list.filter(
          (item) =>
            item.house?.house?.supervisor_id === user.id ||
            item.house?.house?.assigned_csw_id === user.id,
        );
      } else if (isCHW) {
        list = list.filter((item) => item.house?.house?.assigned_csw_id === user.id);
      }
    }

    // Eligibility filter (only when not searching)
    if (!isSearching) {
      list = list.filter((item) => item.summary.isEligible && item.dueDate != null);
    }

    return list;
  }, [allFollowUpItems, isAdmin, user, isSupervisor, isCHW, isSearching]);

  /* -------- KPI COUNTERS ------------------------------------------------- */
  const counters = useMemo(() => {
    let dueToday = 0;
    let upcoming = 0;
    let overdue = 0;
    let completed = 0;
    let high = 0;
    let moderate = 0;
    let normal = 0;

    if (data) {
      completed = data.followUps.filter((f) => f.status === "completed").length;
    }

    for (const item of baseFollowUps) {
      if (item.summary.isEligible) {
        if (item.risk === "high") high++;
        else if (item.risk === "moderate") moderate++;
        else normal++;

        if (item.status === "today") dueToday++;
        else if (item.status === "overdue") overdue++;
        else if (item.status === "upcoming") {
          if (item.daysDiffFromToday >= 0 && item.daysDiffFromToday <= 7) {
            upcoming++;
          }
        }
      }
    }

    return {
      total: baseFollowUps.length,
      dueToday,
      upcoming,
      overdue,
      completed,
      high,
      moderate,
      normal,
    };
  }, [baseFollowUps, data]);

  /* -------- CALENDAR DATE COUNTS ----------------------------------------- */
  const followUpDateCounts = useMemo(() => {
    const counts = new Map<
      string,
      { total: number; high: number; moderate: number; normal: number }
    >();
    for (const item of baseFollowUps) {
      if (item.dueDate) {
        const curr = counts.get(item.dueDate) ?? { total: 0, high: 0, moderate: 0, normal: 0 };
        curr.total++;
        if (item.risk === "high") curr.high++;
        else if (item.risk === "moderate") curr.moderate++;
        else curr.normal++;
        counts.set(item.dueDate, curr);
      }
    }
    return counts;
  }, [baseFollowUps]);

  /* -------- VISIBLE ITEMS (Combined filters) ------------------------------ */
  const visibleItems = useMemo(() => {
    let list = baseFollowUps;

    // 1. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const name = item.member?.name?.toLowerCase() ?? "";
        const memberId = item.member?.memberId?.toLowerCase() ?? "";
        const houseId = item.house?.house?.house_id?.toLowerCase() ?? "";
        const houseNumber = item.house?.house?.house_number?.toLowerCase() ?? "";
        return (
          name.includes(q) || memberId.includes(q) || houseId.includes(q) || houseNumber.includes(q)
        );
      });
    }

    // 2. LEVEL 1 — Risk Filter
    if (!isSearching) {
      if (riskFilter === "high") {
        list = list.filter((i) => i.risk === "high");
      } else if (riskFilter === "moderate") {
        list = list.filter((i) => i.risk === "moderate");
      } else if (riskFilter === "normal") {
        list = list.filter((i) => i.risk === "low");
      }
    }

    // 3. LEVEL 2 — Status/Date Filter
    // Business definitions:
    // "today"    = follow-up date is today
    // "upcoming" = follow-up date is in the future (> today)
    // "due"      = has an ACTIVE PENDING follow-up record in the DB (status=pending)
    //              This means follow-up has been formally scheduled and awaits completion.
    //              Distinct from "overdue" (which is a date-past condition).
    // "completed"= follow-up occurrence has been completed
    if (!isSearching) {
      if (statusFilter === "today") {
        list = list.filter((i) => i.dueDate === todayKey);
      } else if (statusFilter === "upcoming") {
        list = list.filter((i) => i.daysDiffFromToday > 0 && i.status !== "completed");
      } else if (statusFilter === "due") {
        // "Due" = members with a formal active pending follow-up record in DB
        // i.e. summary.activeFollowUpId is set (DB status = 'pending')
        list = list.filter((i) => Boolean(i.summary.activeFollowUpId));
      } else if (statusFilter === "completed") {
        list = list.filter((i) => i.status === "completed" || i.summary.history.length > 0);
      }
      // "all" = show everything
    }

    // 4. House filter
    if (houseFilter !== "all") {
      list = list.filter((i) => i.member?.houseUuid === houseFilter);
    }

    // 5. Condition filter
    if (conditionFilter !== "all") {
      list = list.filter((i) => {
        const conds = i.member?.conditions?.map((c) => c.toLowerCase()) || [];
        const hasBP = conds.some(
          (c) => c.includes("hyper") || c.includes("bp") || c.includes("press"),
        );
        const hasSugar = conds.some((c) => c.includes("diabet") || c.includes("sugar"));
        if (conditionFilter === "bp") return hasBP && !hasSugar;
        if (conditionFilter === "sugar") return hasSugar && !hasBP;
        if (conditionFilter === "bp_sugar") return hasBP && hasSugar;
        if (conditionFilter === "other") return conds.length > 0 && !hasBP && !hasSugar;
        return true;
      });
    }

    // 6. Calendar date filter
    if (selectedCalDate) {
      list = list.filter((i) => i.dueDate === selectedCalDate);
    }

    // 7. Sort
    list = [...list].sort((a, b) => {
      if (sortBy === "dueDate") return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      if (sortBy === "risk") {
        const rank = { high: 0, moderate: 1, low: 2 };
        return rank[a.risk] - rank[b.risk];
      }
      if (sortBy === "name") return (a.member?.name ?? "").localeCompare(b.member?.name ?? "");
      if (sortBy === "surveyDate") return (b.surveyDate ?? "").localeCompare(a.surveyDate ?? "");
      return 0;
    });

    return list;
  }, [
    baseFollowUps,
    searchQuery,
    isSearching,
    riskFilter,
    statusFilter,
    houseFilter,
    conditionFilter,
    selectedCalDate,
    todayKey,
    sortBy,
  ]);

  /* -------- HOUSE / OPTIONS ----------------------------------------------- */
  const houseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allFollowUpItems) {
      if (item.member?.houseUuid && item.house?.house) {
        map.set(
          item.member.houseUuid,
          item.house.house.house_id || item.house.house.house_number || "House",
        );
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allFollowUpItems]);

  /* -------- CHW WORKLOAD -------------------------------------------------- */
  const completedTodayCount = useMemo(() => {
    if (!data) return 0;
    return data.followUps.filter(
      (f) => f.status === "completed" && f.updated_at && toDateKeySafe(f.updated_at) === todayKey,
    ).length;
  }, [data, todayKey]);

  const todayCHWFollowUps = useMemo(() => {
    if (!isCHW) return [];
    return baseFollowUps.filter((i) => i.dueDate === todayKey);
  }, [baseFollowUps, isCHW, todayKey]);

  /* -------- SELECTED DATE STATS ------------------------------------------ */
  const selectedDateStats = useMemo(() => {
    const targetDate = selectedCalDate || todayKey;
    const dateItems = baseFollowUps.filter((i) => i.dueDate === targetDate);
    const high = dateItems.filter((i) => i.risk === "high").length;
    const moderate = dateItems.filter((i) => i.risk === "moderate").length;
    const normal = dateItems.filter((i) => i.risk === "low").length;
    const pieData = [
      { name: "High Risk", value: high, color: "#ef4444" },
      { name: "Moderate Risk", value: moderate, color: "#f97316" },
      { name: "Normal Risk", value: normal, color: "#3b82f6" },
    ].filter((d) => d.value > 0);
    return {
      date: targetDate,
      displayDate: formatDisplayDate(targetDate),
      total: dateItems.length,
      high,
      moderate,
      normal,
      pieData,
    };
  }, [baseFollowUps, selectedCalDate, todayKey]);

  /* -------- MUTATIONS ------------------------------------------------------- */
  const completeMutation = useMutation({
    mutationFn: async ({
      id,
      vitals,
      notes,
    }: {
      id: string;
      vitals?: { systolic: number; diastolic: number; bloodSugar: number | null } | undefined;
      notes?: string | undefined;
    }) => {
      await completeFollowUp({ id, vitals, notes });
    },
    onSuccess: () => {
      toast.success("Follow-up completed and next visit scheduled!");
      setCompleteTarget(null);
      setCompleteSystolic("");
      setCompleteDiastolic("");
      setCompleteSugar("");
      setCompleteNotes("");
      void refresh();
    },
    onError: (e: any) => toast.error(e.message || "Failed to complete follow-up"),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      await postponeFollowUp(id, date);
    },
    onSuccess: () => {
      toast.success("Follow-up rescheduled successfully!");
      setRescheduleTarget(null);
      setRescheduleDate("");
      void refresh();
    },
    onError: (e: any) => toast.error(e.message || "Failed to reschedule follow-up"),
  });

  /* -------- HELPERS --------------------------------------------------------- */
  const handleResetFilters = () => {
    setSearchQuery("");
    setHouseFilter("all");
    setConditionFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
    setSelectedCalDate(null);
  };

  const handleExportCSV = () => {
    if (visibleItems.length === 0) {
      toast.error("No records to export.");
      return;
    }
    const rows = [
      [
        "Member Name",
        "Member ID",
        "House ID",
        "Risk Level",
        "Survey Date",
        "Follow-up Date",
        "Status",
        "Assigned CHW",
      ],
      ...visibleItems.map((item) => [
        `"${item.member?.name || ""}"`,
        `"${item.member?.memberId || ""}"`,
        `"${item.house?.house?.house_id || item.member?.houseId || ""}"`,
        `"${item.risk.toUpperCase()}"`,
        `"${item.displaySurveyDate}"`,
        `"${item.displayDueDate}"`,
        `"${item.status.toUpperCase()}"`,
        `"${item.assignedChwName || "Unassigned"}"`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `followups_${todayKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported follow-ups successfully.");
  };

  /* ========================================================================= */
  /*                             SKELETON STATE                                */
  /* ========================================================================= */

  if (isLoading) {
    return isMobile ? (
      <div className="flex flex-col h-screen bg-background animate-in fade-in duration-300">
        {/* Mobile skeleton header */}
        <div className="flex-none px-4 pt-4 pb-3 border-b border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-7 w-28 bg-muted rounded-lg animate-pulse" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="size-9 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 flex-1 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 flex-1 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <FollowUpSkeleton key={i} />
          ))}
        </div>
      </div>
    ) : (
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-surface-muted/10 animate-in fade-in duration-300">
        <div className="flex-none px-6 pt-6 space-y-6">
          <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-6 pt-4 pb-4">
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="w-full lg:col-span-8 flex flex-col gap-4 h-full">
              <div className="h-[72px] bg-muted rounded-2xl animate-pulse" />
              <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <FollowUpSkeleton key={i} />
                ))}
              </div>
            </div>
            <div className="col-span-4 flex flex-col gap-4">
              <div className="h-[340px] bg-muted rounded-3xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="p-8 max-w-sm w-full space-y-4 bg-white rounded-3xl border border-border/60 shadow-card">
          <AlertTriangle className="size-10 text-risk-high mx-auto" />
          <h2 className="font-display text-lg font-semibold text-foreground">
            Failed to load follow-ups
          </h2>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Error"}
          </p>
          <Button onClick={() => void refresh()} className="w-full rounded-xl">
            <RotateCcw className="size-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /*                           MOBILE RENDER                                   */
  /* ========================================================================= */

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        {/* ================================================================== */}
        {/* MOBILE HEADER                                                       */}
        {/* ================================================================== */}
        <div className="flex-none bg-white border-b border-border/50 px-4 pt-4 pb-3 space-y-3">
          {/* Top bar: title + action icons */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-display font-bold text-xl text-foreground">Follow-ups</h1>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMobileSearch(!showMobileSearch)}
                className="size-9 flex items-center justify-center rounded-xl bg-surface-muted hover:bg-muted transition-colors"
                aria-label="Search"
              >
                <Search className="size-4 text-foreground" />
              </button>
              <button
                onClick={() => setShowCalendarDrawer(true)}
                className={cn(
                  "size-9 flex items-center justify-center rounded-xl transition-colors",
                  selectedCalDate
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-muted hover:bg-muted",
                )}
                aria-label="Calendar"
              >
                <CalendarDays
                  className={cn("size-4", selectedCalDate ? "text-white" : "text-foreground")}
                />
              </button>
              <button
                onClick={() => setShowFiltersBar(true)}
                className={cn(
                  "size-9 flex items-center justify-center rounded-xl transition-colors",
                  houseFilter !== "all" || conditionFilter !== "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-muted hover:bg-muted",
                )}
                aria-label="More filters"
              >
                <SlidersHorizontal className="size-4 text-foreground" />
              </button>

              {/* Role-specific primary action */}
              {isCHW ? (
                <Link to="/map" search={{ filter: "today_followups" }}>
                  <button className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                    <MapPin className="size-4" />
                    <span>Run</span>
                  </button>
                </Link>
              ) : (
                <button
                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm"
                  onClick={() => toast.info("Task builder coming soon")}
                >
                  <Plus className="size-4" />
                  <span>Task</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline search (toggleable) */}
          {showMobileSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="Search name, ID, house…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 rounded-xl bg-surface-muted/50 border-border/60 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          {/* RISK FILTER CHIPS — Level 1 */}
          <div className="flex gap-2">
            {(["all", "high", "moderate", "normal"] as RiskFilter[]).map((r) => {
              const count =
                r === "all"
                  ? counters.total
                  : r === "high"
                    ? counters.high
                    : r === "moderate"
                      ? counters.moderate
                      : counters.normal;
              const isActive = riskFilter === r;
              const colorCls =
                r === "high"
                  ? isActive
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-red-50 text-red-600 border-red-200"
                  : r === "moderate"
                    ? isActive
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-orange-50 text-orange-600 border-orange-200"
                    : r === "normal"
                      ? isActive
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                      : isActive
                        ? "bg-foreground text-background border-foreground"
                        : "bg-surface-muted text-muted-foreground border-border/60";

              return (
                <button
                  key={r}
                  onClick={() => setRiskFilter(isActive && r !== "all" ? "all" : r)}
                  className={cn(
                    "flex-1 flex flex-col items-center py-2 rounded-xl border text-xs font-bold transition-all",
                    colorCls,
                  )}
                >
                  <span className="text-base font-display font-extrabold leading-none">
                    {count}
                  </span>
                  <span className="mt-0.5 capitalize">{r === "all" ? "Total" : r}</span>
                </button>
              );
            })}
          </div>

          {/* STATUS FILTER TABS — Level 2 */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {(["all", "today", "upcoming", "due", "completed"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all border",
                  statusFilter === s
                    ? "bg-foreground text-background border-foreground"
                    : "bg-surface-muted text-muted-foreground border-transparent hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar date active badge */}
        {selectedCalDate && (
          <div className="flex-none mx-4 mt-2 flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Showing {formatDisplayDate(selectedCalDate)}
            </span>
            <button onClick={() => setSelectedCalDate(null)} className="hover:underline">
              Clear
            </button>
          </div>
        )}

        {/* CHW workload card */}
        {isCHW && (
          <div className="flex-none mx-4 mt-2 rounded-2xl border border-border/60 bg-white shadow-sm p-3 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                My Daily Task
              </p>
              <p className="text-xs text-muted-foreground">Today's Follow-ups</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-bold text-foreground leading-none">
                {dailyTarget}
              </p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="text-right">
              <p className="text-lg font-display font-bold text-emerald-600 leading-none">
                {completedTodayCount}
              </p>
              <p className="text-[10px] text-muted-foreground">Done</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-display font-bold text-primary leading-none">
                {Math.max(0, dailyTarget - completedTodayCount)}
              </p>
              <p className="text-[10px] text-muted-foreground">Left</p>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex-none px-4 pt-2 pb-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-semibold">
            {visibleItems.length} Follow-up{visibleItems.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1.5 text-xs">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-7 rounded-lg text-xs bg-white w-[110px] border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Follow-up Date</SelectItem>
                <SelectItem value="risk">Risk Level</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MOBILE CARD LIST (only this scrolls)                               */}
        {/* ================================================================== */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
          {visibleItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CalendarDays className="size-10 text-muted-foreground/30 mx-auto" />
              <h3 className="font-display text-sm font-bold text-foreground">
                No follow-ups found
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {isSearching
                  ? "No matching members for your search."
                  : "No follow-ups match the selected filters."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="rounded-xl mt-1"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            visibleItems.map((item) => (
              <FollowUpCard
                key={item.id}
                item={item}
                minEligibleAge={minEligibleAge}
                onReschedule={(i) => {
                  setRescheduleTarget(i);
                  setRescheduleDate(i.dueDate || todayKey);
                }}
                onComplete={(i) => {
                  setCompleteTarget(i);
                  setCompleteSystolic(i.member?.systolic?.toString() || "");
                  setCompleteDiastolic(i.member?.diastolic?.toString() || "");
                  setCompleteSugar(i.member?.bloodSugar?.toString() || "");
                  setCompleteNotes("");
                }}
              />
            ))
          )}
        </div>

        {/* Mobile dialogs reuse same ones below */}
        {renderDialogs()}
        {renderCalendarDrawer()}
        {renderFiltersSheet()}
      </div>
    );
  }

  /* ========================================================================= */
  /*                           DESKTOP RENDER                                  */
  /* ========================================================================= */

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-surface-muted/10 animate-in fade-in duration-300">
      {/* FIXED TOP SECTION */}
      <div className="flex-none px-6 pt-6 space-y-5">
        {/* Desktop Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Follow-ups</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track and manage scheduled member follow-ups.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-surface-muted/60 px-3.5 py-2 rounded-xl border border-border/50">
              <CalendarIcon className="size-4 text-primary" />
              <span>
                {now.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            {/* Role-specific primary action */}
            {isCHW ? (
              <Link to="/map" search={{ filter: "today_followups" }}>
                <Button className="rounded-xl h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-sm">
                  <MapPin className="size-4" /> Run Map
                </Button>
              </Link>
            ) : (
              <Button
                className="rounded-xl h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-sm"
                onClick={() => toast.info("Task builder coming soon")}
              >
                <Plus className="size-4" /> Task Builder
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={handleExportCSV}
              className="size-9 rounded-xl"
              title="Export CSV"
            >
              <Download className="size-4" />
            </Button>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FollowUpKpi
            title="TODAY"
            count={counters.dueToday}
            subtitle="Due today"
            icon={CalendarDays}
            colorScheme="blue"
            isActive={statusFilter === "today"}
            onClick={() => {
              setStatusFilter((s) => (s === "today" ? "all" : "today"));
            }}
          />
          <FollowUpKpi
            title="UPCOMING"
            count={counters.upcoming}
            subtitle="Next 7 days"
            icon={Clock}
            colorScheme="purple"
            isActive={statusFilter === "upcoming"}
            onClick={() => {
              setStatusFilter((s) => (s === "upcoming" ? "all" : "upcoming"));
            }}
          />
          <FollowUpKpi
            title="OVERDUE"
            count={counters.overdue}
            subtitle="Past due"
            icon={AlertTriangle}
            colorScheme="red"
            isActive={statusFilter === "due"}
            onClick={() => {
              setStatusFilter((s) => (s === "due" ? "all" : "due"));
            }}
          />
          <FollowUpKpi
            title="COMPLETED"
            count={counters.completed}
            subtitle="All time"
            icon={CheckCircle2}
            colorScheme="emerald"
            isActive={statusFilter === "completed"}
            onClick={() => {
              setStatusFilter((s) => (s === "completed" ? "all" : "completed"));
            }}
          />
        </div>
      </div>

      {/* SCROLLING CONTENT AREA */}
      <div className="flex-1 overflow-hidden px-6 pt-4 pb-4">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 h-full">
          {/* ============================================================== */}
          {/* CENTER COLUMN: Search + Cards                                   */}
          {/* ============================================================== */}
          <div className="col-span-8 flex flex-col h-full gap-3">
            {/* Search + Action Bar */}
            <div className="shrink-0 flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search name, member ID, house ID… (Ctrl K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-9 rounded-xl bg-white border-border/60 h-11 text-sm"
                  aria-label="Search members"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFiltersBar(true)}
                className={cn(
                  "rounded-xl h-11 px-3.5 border-border/60 text-xs font-semibold gap-1.5",
                  (conditionFilter !== "all" || houseFilter !== "all") &&
                    "bg-primary-soft text-primary border-primary/20",
                )}
              >
                <SlidersHorizontal className="size-4" /> Filters
              </Button>
            </div>

            {/* Calendar date badge */}
            {selectedCalDate && (
              <div className="shrink-0 flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  <span>Showing follow-ups for {formatDisplayDate(selectedCalDate)}</span>
                </div>
                <button
                  onClick={() => setSelectedCalDate(null)}
                  className="hover:underline text-[11px]"
                >
                  Clear Date Filter
                </button>
              </div>
            )}

            {/* Results header */}
            <div className="shrink-0 flex items-center justify-between px-1">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-display font-bold text-foreground">
                    {riskFilter !== "all" ? riskFilter.toUpperCase() : "ALL RISKS"}
                    {statusFilter !== "all" ? ` — ${statusFilter.toUpperCase()}` : ""}
                  </h2>
                  {(riskFilter !== "all" || statusFilter !== "all") && (
                    <button
                      onClick={handleResetFilters}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      reset
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {visibleItems.length} Follow-up{visibleItems.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground hidden sm:inline">Sort by:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-8 rounded-xl text-xs bg-white w-[130px] border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dueDate">Follow-up Date</SelectItem>
                      <SelectItem value="risk">Risk Level</SelectItem>
                      <SelectItem value="name">Member Name</SelectItem>
                      <SelectItem value="surveyDate">Survey Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center rounded-xl bg-surface-muted/60 p-0.5 border border-border/50">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      viewMode === "list"
                        ? "bg-white text-primary shadow-xs"
                        : "text-muted-foreground",
                    )}
                    aria-label="List view"
                  >
                    <List className="size-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      viewMode === "grid"
                        ? "bg-white text-primary shadow-xs"
                        : "text-muted-foreground",
                    )}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* CARDS — THE ONLY SCROLLING REGION */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6">
              {visibleItems.length === 0 ? (
                <div className="card-surface p-12 rounded-3xl border border-dashed border-border text-center space-y-3 bg-white">
                  <CalendarDays className="size-10 text-muted-foreground/40 mx-auto" />
                  <h3 className="font-display text-base font-bold text-foreground">
                    No follow-ups found
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {isSearching
                      ? "No matching members for your search query."
                      : "No scheduled follow-ups match the selected filters."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="rounded-xl mt-2"
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "grid gap-3.5",
                    viewMode === "grid" ? "sm:grid-cols-2" : "grid-cols-1",
                  )}
                >
                  {visibleItems.map((item) => (
                    <FollowUpCard
                      key={item.id}
                      item={item}
                      minEligibleAge={minEligibleAge}
                      onReschedule={(i) => {
                        setRescheduleTarget(i);
                        setRescheduleDate(i.dueDate || todayKey);
                      }}
                      onComplete={(i) => {
                        setCompleteTarget(i);
                        setCompleteSystolic(i.member?.systolic?.toString() || "");
                        setCompleteDiastolic(i.member?.diastolic?.toString() || "");
                        setCompleteSugar(i.member?.bloodSugar?.toString() || "");
                        setCompleteNotes("");
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT PANEL — Fixed stable panel                                */}
          {/* ============================================================== */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-4 h-full overflow-y-auto pr-1 pb-6">
            {/* FILTERS SECTION */}
            <div className="card-surface p-4 rounded-2xl border border-border/60 bg-white shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Filters
                </h3>
                {(riskFilter !== "all" || statusFilter !== "all") && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="size-3" /> Reset
                  </button>
                )}
              </div>

              {/* Risk filter row */}
              <div className="flex gap-1.5">
                {(["high", "moderate", "normal"] as const).map((r) => {
                  const isActive = riskFilter === r;
                  const colorCls =
                    r === "high"
                      ? isActive
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                      : r === "moderate"
                        ? isActive
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                        : isActive
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
                  return (
                    <button
                      key={r}
                      onClick={() => setRiskFilter(isActive ? "all" : r)}
                      className={cn(
                        "flex-1 py-1.5 rounded-xl border text-[11px] font-bold capitalize transition-all",
                        colorCls,
                      )}
                    >
                      {r === "normal" ? "Normal" : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  );
                })}
              </div>

              {/* Status filter row */}
              <div className="flex gap-1 flex-wrap">
                {(["all", "today", "upcoming", "due", "completed"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[11px] font-semibold capitalize transition-all border",
                      statusFilter === s
                        ? "bg-foreground text-background border-foreground"
                        : "bg-surface-muted text-muted-foreground border-transparent hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* RUN SECTION */}
            <div className="card-surface p-4 rounded-2xl border border-border/60 bg-white shadow-card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    RUN (Today's Follow-ups)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Open map with today's route.
                  </p>
                </div>
                <Link to="/map" search={{ filter: "today_followups" }}>
                  <Button
                    size="sm"
                    className="rounded-xl h-8 px-3 text-xs font-bold bg-primary gap-1.5"
                  >
                    <MapPin className="size-3.5" /> Run
                  </Button>
                </Link>
              </div>
              {/* Map preview placeholder */}
              <div className="h-24 rounded-xl bg-gradient-to-br from-blue-50 to-green-50 border border-border/40 flex items-center justify-center">
                <p className="text-[10px] text-muted-foreground text-center px-4">
                  {counters.dueToday > 0
                    ? `${counters.dueToday} follow-up${counters.dueToday !== 1 ? "s" : ""} due today — click Run for optimized route`
                    : "No follow-ups for today. No pins to show."}
                </p>
              </div>
            </div>

            {/* CALENDAR */}
            <div className="card-surface p-4 rounded-2xl border border-border/60 bg-white shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Calendar
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-lg"
                    onClick={() => {
                      if (calMonth === 0) {
                        setCalMonth(11);
                        setCalYear(calYear - 1);
                      } else setCalMonth(calMonth - 1);
                    }}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="text-xs font-bold text-foreground">
                    {new Date(calYear, calMonth, 1).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-lg"
                    onClick={() => {
                      if (calMonth === 11) {
                        setCalMonth(0);
                        setCalYear(calYear + 1);
                      } else setCalMonth(calMonth + 1);
                    }}
                    aria-label="Next month"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
              <MiniCalendarGrid
                year={calYear}
                month={calMonth}
                todayKey={todayKey}
                selectedDate={selectedCalDate}
                onSelectDate={(d) => setSelectedCalDate(selectedCalDate === d ? null : d)}
                countsMap={followUpDateCounts}
              />
              {selectedCalDate && (
                <button
                  onClick={() => setSelectedCalDate(null)}
                  className="w-full text-[11px] text-primary font-semibold hover:underline"
                >
                  Clear date filter
                </button>
              )}
            </div>

            {/* QUICK STATS */}
            <div className="card-surface p-4 rounded-2xl border border-border/60 bg-white shadow-card space-y-2">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">
                {selectedCalDate ? `${formatDisplayDate(selectedCalDate)}` : "Today's Summary"}
              </h3>
              {[
                {
                  label: "Due Today",
                  value: counters.dueToday,
                  color: "text-blue-600",
                  icon: CalendarDays,
                  action: () => setStatusFilter("today"),
                },
                {
                  label: "Overdue",
                  value: counters.overdue,
                  color: "text-red-600",
                  icon: AlertTriangle,
                  action: () => setStatusFilter("due"),
                },
                {
                  label: "Upcoming (7d)",
                  value: counters.upcoming,
                  color: "text-purple-600",
                  icon: Clock,
                  action: () => setStatusFilter("upcoming"),
                },
                {
                  label: "Completed",
                  value: counters.completed,
                  color: "text-emerald-600",
                  icon: CheckCircle2,
                  action: () => setStatusFilter("completed"),
                },
              ].map(({ label, value, color, icon: Icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface-muted/70 transition-colors text-xs font-semibold"
                >
                  <span className={cn("flex items-center gap-2", color)}>
                    <Icon className="size-3.5" /> {label}
                  </span>
                  <span className={cn("font-bold", color)}>{value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {renderDialogs()}
      {renderFiltersSheet()}
      {renderCalendarDrawer()}
    </div>
  );

  /* ========================================================================= */
  /*                         SHARED DIALOG HELPERS                             */
  /* ========================================================================= */

  function renderDialogs() {
    return (
      <>
        {/* Complete Dialog */}
        <Dialog
          open={Boolean(completeTarget)}
          onOpenChange={(open) => !open && setCompleteTarget(null)}
        >
          <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Complete Follow-up Visit</DialogTitle>
              <DialogDescription>
                Record new clinical vitals for {completeTarget?.member?.name}. Enter readings or
                skip to preserve existing risk.
              </DialogDescription>
            </DialogHeader>
            {completeTarget && (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/50 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-foreground">{completeTarget.member?.name}</p>
                    <p className="text-muted-foreground">
                      House ID:{" "}
                      {completeTarget.house?.house?.house_id ||
                        completeTarget.member?.houseId ||
                        "—"}
                    </p>
                  </div>
                  <RiskBadge level={completeTarget.risk} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Systolic BP</label>
                    <Input
                      type="number"
                      value={completeSystolic}
                      onChange={(e) => setCompleteSystolic(e.target.value)}
                      placeholder="e.g. 120"
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Diastolic BP</label>
                    <Input
                      type="number"
                      value={completeDiastolic}
                      onChange={(e) => setCompleteDiastolic(e.target.value)}
                      placeholder="e.g. 80"
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Blood Sugar (mg/dL)
                  </label>
                  <Input
                    type="number"
                    value={completeSugar}
                    onChange={(e) => setCompleteSugar(e.target.value)}
                    placeholder="e.g. 110"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Follow-up Notes</label>
                  <Input
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    placeholder="e.g. Rechecked BP, advised low sodium diet"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  if (completeTarget)
                    completeMutation.mutate({
                      id: completeTarget.id,
                      notes: completeNotes || "Vitals skipped during follow-up",
                    });
                }}
                disabled={completeMutation.isPending}
                className="rounded-xl font-semibold flex-1 text-xs"
              >
                SKIP VITALS
              </Button>
              <Button
                onClick={() => {
                  if (completeTarget) {
                    const sys = parseInt(completeSystolic, 10);
                    const dia = parseInt(completeDiastolic, 10);
                    const sug = completeSugar ? parseInt(completeSugar, 10) : null;
                    if (!isNaN(sys) && !isNaN(dia)) {
                      completeMutation.mutate({
                        id: completeTarget.id,
                        vitals: { systolic: sys, diastolic: dia, bloodSugar: sug },
                        notes: completeNotes || undefined,
                      });
                    } else {
                      toast.error(
                        "Please enter both Systolic and Diastolic BP, or click 'Skip Vitals'.",
                      );
                    }
                  }
                }}
                disabled={completeMutation.isPending}
                className="rounded-xl font-semibold flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {completeMutation.isPending ? "Saving..." : "SAVE & COMPLETE"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reschedule Dialog */}
        <Dialog
          open={Boolean(rescheduleTarget)}
          onOpenChange={(open) => !open && setRescheduleTarget(null)}
        >
          <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Reschedule Follow-up</DialogTitle>
              <DialogDescription>
                Select a new follow-up date for {rescheduleTarget?.member?.name}.
              </DialogDescription>
            </DialogHeader>
            {rescheduleTarget && (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/50 text-xs">
                  <p className="font-bold text-foreground">{rescheduleTarget.member?.name}</p>
                  <p className="text-muted-foreground mt-0.5">
                    Current Due Date: {rescheduleTarget.displayDueDate}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    New Follow-up Date
                  </label>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    min={todayKey}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setRescheduleTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (rescheduleTarget && rescheduleDate)
                    rescheduleMutation.mutate({ id: rescheduleTarget.id, date: rescheduleDate });
                }}
                disabled={rescheduleMutation.isPending || !rescheduleDate}
                className="rounded-xl font-semibold"
              >
                {rescheduleMutation.isPending ? "Rescheduling..." : "Save Date"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  function renderCalendarDrawer() {
    return (
      <Drawer open={showCalendarDrawer} onOpenChange={setShowCalendarDrawer}>
        <DrawerContent className="max-w-lg mx-auto rounded-t-3xl border-border bg-white p-5 space-y-4">
          <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base">Select Follow-up Date</h3>
            {selectedCalDate && (
              <button
                onClick={() => {
                  setSelectedCalDate(null);
                  setShowCalendarDrawer(false);
                }}
                className="text-xs text-primary font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              onClick={() => {
                if (calMonth === 0) {
                  setCalMonth(11);
                  setCalYear(calYear - 1);
                } else setCalMonth(calMonth - 1);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-bold">
              {new Date(calYear, calMonth, 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              onClick={() => {
                if (calMonth === 11) {
                  setCalMonth(0);
                  setCalYear(calYear + 1);
                } else setCalMonth(calMonth + 1);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <MiniCalendarGrid
            year={calYear}
            month={calMonth}
            todayKey={todayKey}
            selectedDate={selectedCalDate}
            onSelectDate={(d) => {
              setSelectedCalDate(selectedCalDate === d ? null : d);
              setShowCalendarDrawer(false);
            }}
            countsMap={followUpDateCounts}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  function renderFiltersSheet() {
    return (
      <Sheet open={showFiltersBar} onOpenChange={setShowFiltersBar}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-white border-l p-0 flex flex-col h-full"
        >
          <SheetHeader className="p-5 border-b border-border/50 text-left">
            <SheetTitle className="font-display font-bold text-xl flex items-center justify-between">
              Filters
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFiltersBar(false)}
                className="size-8 rounded-full"
              >
                <X className="size-5 text-muted-foreground" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="space-y-3">
              <label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Condition
              </label>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-surface-muted/30">
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conditions</SelectItem>
                  <SelectItem value="bp">BP / Hypertension</SelectItem>
                  <SelectItem value="sugar">Sugar / Diabetes</SelectItem>
                  <SelectItem value="bp_sugar">BP + Sugar</SelectItem>
                  <SelectItem value="other">Other conditions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                House
              </label>
              <Select value={houseFilter} onValueChange={setHouseFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-surface-muted/30">
                  <SelectValue placeholder="All Houses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Houses</SelectItem>
                  {houseOptions.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-5 border-t border-border/50 bg-surface-muted/10">
            <Button
              variant="outline"
              onClick={() => {
                handleResetFilters();
                setShowFiltersBar(false);
              }}
              className="w-full h-11 rounded-xl text-sm font-semibold border-border/60 bg-white"
            >
              <RotateCcw className="size-4 mr-2 text-muted-foreground" /> Clear All Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
}
