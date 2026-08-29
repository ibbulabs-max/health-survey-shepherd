import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  User,
  Home,
  Activity,
  Droplets,
  CalendarClock,
  XCircle,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { tables } from "@/config/database";
import { followUpConfig } from "@/config/followups";
import type { RiskLevel } from "@/config/risk";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUsers } from "@/hooks/useUsers";
import { getUserDisplayName } from "@/services/userService";
import { asRisk, followUpStatus, toDateKey, type MemberView, type HouseView } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  completeFollowUp,
  postponeFollowUp,
} from "@/services/followUpService";
import { FollowUpTarget } from "@/components/followups/FollowUpTarget";
import type { FollowUp } from "@/db/types";

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
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type StatusTab = "high" | "moderate" | "normal" | "completed";

interface EnrichedFollowUp {
  followUp: FollowUp;
  member: MemberView | null;
  house: HouseView | null;
  assignedChwName: string | null;
  daysOverdue: number;
  statusLabel: string;
}

/* -------------------------------------------------------------------------- */
/*                             Date Helpers                                   */
/* -------------------------------------------------------------------------- */

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

function getDueDateLabel(dueDate: string | null, today: string): string {
  if (!dueDate) return "No date";
  if (dueDate === today) return "Due Today";
  const diff = daysBetween(today, dueDate);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff <= 7) return `In ${diff} days`;
  return formatShortDate(dueDate);
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDate; i++) {
    days.push(new Date(year, month, i));
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]!;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    days.push(next);
  }
  return days;
}

/* -------------------------------------------------------------------------- */
/*                          Reduced Motion Hook                               */
/* -------------------------------------------------------------------------- */

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return prefersReduced;
}

/* -------------------------------------------------------------------------- */
/*                            MAIN PAGE COMPONENT                             */
/* -------------------------------------------------------------------------- */

function FollowUpsPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const refresh = useRefreshDataset();
  const { role, isAdmin, user } = useAuth();
  const isMobile = useIsMobile();
  const prefersReduced = usePrefersReducedMotion();
  const { data: users } = useUsers();

  const [tab, setTab] = useState<StatusTab>("high");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [chwFilter, setChwFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [houseFilter, setHouseFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [holidays, setHolidays] = useState<string[]>([]);
  useEffect(() => {
    import("@/services/holidayService").then((m) => {
      m.fetchHolidays().then((h) => setHolidays(h.map((x) => x.holiday_date)));
    });
  }, []);

  // Calendar state
  const now = new Date();
  const todayKey = toDateKey(now);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(!isMobile);

  // Mobile filter drawer
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Complete dialog
  const [completeTarget, setCompleteTarget] = useState<EnrichedFollowUp | null>(null);
  const [completeSystolic, setCompleteSystolic] = useState("");
  const [completeDiastolic, setCompleteDiastolic] = useState("");
  const [completeSugar, setCompleteSugar] = useState("");

  // Reschedule dialog
  const [rescheduleTarget, setRescheduleTarget] = useState<EnrichedFollowUp | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Success animation
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const animClass = prefersReduced ? "" : "animate-in fade-in slide-in-from-bottom-2 duration-300";
  const animClassFast = prefersReduced ? "" : "animate-in fade-in duration-200";

  // User lookup
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    if (users) {
      for (const u of users) {
        m.set(u.profile.id, getUserDisplayName(u));
      }
    }
    return m;
  }, [users]);

  // Enrich follow-ups
  const enriched = useMemo<EnrichedFollowUp[]>(() => {
    if (!data) return [];
    return data.followUps.map((f) => {
      const member = f.member_uuid ? data.byMemberId.get(f.member_uuid) ?? null : null;
      const house = f.house_uuid ? data.byHouseUuid.get(f.house_uuid) ?? null : null;
      const chwId = house?.house?.assigned_csw_id ?? f.created_by ?? null;
      const chwName = chwId ? userMap.get(chwId) ?? null : null;
      const daysOverdue =
        f.due_date && f.due_date < todayKey && (f.status ?? "pending") === "pending"
          ? daysBetween(f.due_date, todayKey)
          : 0;
      return {
        followUp: f,
        member,
        house,
        assignedChwName: chwName,
        daysOverdue,
        statusLabel: getDueDateLabel(f.due_date, todayKey),
      };
    });
  }, [data, todayKey, userMap]);

  // Categorize
  const categorized = useMemo(() => {
    const groups: Record<StatusTab, EnrichedFollowUp[]> = {
      high: [],
      moderate: [],
      normal: [],
      completed: [],
    };
    for (const e of enriched) {
      // 30+ Eligibility Check (Age 29 is NOT eligible, 30+ IS eligible)
      const age = e.member?.age;
      const isEligible = age != null && age >= 30;

      const s = followUpStatus(e.followUp.status, e.followUp.due_date);
      if (s === "completed" || s === "missed") {
        groups.completed.push(e);
      } else if (isEligible) { // Only show eligible members in active tabs
        const risk = asRisk(e.followUp.risk_level ?? e.member?.risk ?? "low");
        if (risk === "high") groups.high.push(e);
        else if (risk === "moderate") groups.moderate.push(e);
        else groups.normal.push(e);
      }
    }
    
    // Sort all active by next follow-up date ascending
    const sortByDate = (a: EnrichedFollowUp, b: EnrichedFollowUp) => 
      (a.followUp.due_date ?? "").localeCompare(b.followUp.due_date ?? "");

    groups.high.sort(sortByDate);
    groups.moderate.sort(sortByDate);
    groups.normal.sort(sortByDate);

    // Sort completed by most recent first
    groups.completed.sort((a, b) =>
      (b.followUp.updated_at ?? b.followUp.created_at ?? "").localeCompare(
        a.followUp.updated_at ?? a.followUp.created_at ?? "",
      ),
    );
    return groups;
  }, [enriched]);

  // Follow-up dates for calendar indicators
  const followUpDateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of enriched) {
      const d = e.followUp.due_date;
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return counts;
  }, [enriched]);

  // Apply filters
  const applyFilters = useCallback(
    (items: EnrichedFollowUp[]): EnrichedFollowUp[] => {
      let filtered = items;

      // Calendar date filter
      if (selectedCalDate) {
        filtered = filtered.filter((e) => e.followUp.due_date === selectedCalDate);
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((e) => {
          const name = e.member?.name?.toLowerCase() ?? "";
          const memberId = e.member?.memberId?.toLowerCase() ?? "";
          const houseId = e.house?.house?.house_id?.toLowerCase() ?? "";
          const houseNumber = e.house?.house?.house_number?.toLowerCase() ?? "";
          return (
            name.includes(q) ||
            memberId.includes(q) ||
            houseId.includes(q) ||
            houseNumber.includes(q)
          );
        });
      }

      // Risk filter
      if (riskFilter !== "all") {
        filtered = filtered.filter((e) => {
          const risk = asRisk(e.followUp.risk_level ?? e.member?.risk ?? "low");
          return risk === riskFilter;
        });
      }

      // CHW filter
      if (chwFilter !== "all") {
        filtered = filtered.filter(
          (e) =>
            e.house?.house?.assigned_csw_id === chwFilter ||
            e.followUp.created_by === chwFilter,
        );
      }

      // Status filter
      if (statusFilter !== "all") {
        filtered = filtered.filter(
          (e) => (e.followUp.status ?? "pending") === statusFilter,
        );
      }

      // House filter
      if (houseFilter !== "all") {
        filtered = filtered.filter(
          (e) => e.followUp.house_uuid === houseFilter,
        );
      }

      // Date preset
      if (datePreset === "today") {
        filtered = filtered.filter((e) => e.followUp.due_date === todayKey);
      } else if (datePreset === "this_week") {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const ws = toDateKey(weekStart);
        const we = toDateKey(weekEnd);
        filtered = filtered.filter(
          (e) =>
            e.followUp.due_date &&
            e.followUp.due_date >= ws &&
            e.followUp.due_date <= we,
        );
      } else if (datePreset === "this_month") {
        const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const me = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        filtered = filtered.filter(
          (e) =>
            e.followUp.due_date &&
            e.followUp.due_date >= ms &&
            e.followUp.due_date <= me,
        );
      } else if (datePreset === "custom" && dateFrom && dateTo) {
        filtered = filtered.filter(
          (e) =>
            e.followUp.due_date &&
            e.followUp.due_date >= dateFrom &&
            e.followUp.due_date <= dateTo,
        );
      }

      return filtered;
    },
    [
      selectedCalDate,
      searchQuery,
      riskFilter,
      chwFilter,
      statusFilter,
      houseFilter,
      datePreset,
      dateFrom,
      dateTo,
      todayKey,
      now,
    ],
  );

  const completedTodayCount = useMemo(() => {
    return categorized.completed.filter(e => {
      // Completed date should be derived from updated_at, fall back to created_at
      const dateStr = e.followUp.updated_at ?? e.followUp.created_at;
      return dateStr && dateStr.startsWith(todayKey);
    }).length;
  }, [categorized.completed, todayKey]);

  const visibleItems = useMemo(() => applyFilters(categorized[tab]), [applyFilters, categorized, tab]);

  // Unique CHWs for filter
  const chwOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const e of enriched) {
      const id = e.house?.house?.assigned_csw_id ?? e.followUp.created_by;
      if (id) ids.add(id);
    }
    return Array.from(ids).map((id) => ({
      id,
      name: userMap.get(id) ?? id.slice(0, 8),
    }));
  }, [enriched, userMap]);

  // Unique houses for filter
  const houseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of enriched) {
      if (e.followUp.house_uuid && e.house) {
        map.set(
          e.followUp.house_uuid,
          e.house.house.house_number ?? e.house.house.house_id ?? e.followUp.house_uuid.slice(0, 8),
        );
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [enriched]);

  // Mutations
  const completeMutation = useMutation({
    mutationFn: (params: { id: string; vitals?: { systolic: number; diastolic: number; bloodSugar: number | null }; holidays?: string[] }) => 
      completeFollowUp(params),
    onSuccess: () => {
      setShowSuccess("completed");
      setTimeout(() => setShowSuccess(null), 2000);
      toast.success("Follow-up marked as completed.");
      setCompleteTarget(null);
      setCompleteSystolic("");
      setCompleteDiastolic("");
      setCompleteSugar("");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not complete follow-up."),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date }) => postponeFollowUp(id, date),
    onSuccess: () => {
      setShowSuccess("rescheduled");
      setTimeout(() => setShowSuccess(null), 2000);
      toast.success("Follow-up rescheduled successfully.");
      setRescheduleTarget(null);
      setRescheduleDate("");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reschedule."),
  });

  const clearFilters = () => {
    setSearchQuery("");
    setRiskFilter("all");
    setChwFilter("all");
    setStatusFilter("all");
    setHouseFilter("all");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setSelectedCalDate(null);
  };

  const hasActiveFilters =
    searchQuery ||
    riskFilter !== "all" ||
    chwFilter !== "all" ||
    statusFilter !== "all" ||
    houseFilter !== "all" ||
    datePreset !== "all" ||
    selectedCalDate;

  /* ======================================================================== */
  /*                             LOADING STATE                                */
  /* ======================================================================== */

  if (isLoading) {
    return (
      <div className={cn("space-y-4 pb-6", animClassFast)}>
        <SkeletonHeader />
        <SkeletonStatusNav />
        <SkeletonFilters />
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  /* ======================================================================== */
  /*                             ERROR STATE                                  */
  /* ======================================================================== */

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-20 px-6 text-center", animClass)}>
        <div className="ios-glass p-8 max-w-sm w-full space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-risk-high-soft flex items-center justify-center">
            <AlertTriangle className="size-7 text-risk-high" />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Unable to load follow-ups
          </h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <Button
            onClick={() => void refetch()}
            className="w-full rounded-2xl font-semibold"
            size="lg"
          >
            <RotateCcw className="size-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabConfig: { key: StatusTab; label: string; icon: typeof CalendarDays; color: string; bgColor: string; count: number }[] = [
    {
      key: "high",
      label: "HIGH RISK",
      icon: AlertTriangle,
      color: "text-risk-high",
      bgColor: "bg-risk-high-soft",
      count: categorized.high.length,
    },
    {
      key: "moderate",
      label: "MODERATE",
      icon: Clock,
      color: "text-risk-moderate",
      bgColor: "bg-risk-moderate-soft",
      count: categorized.moderate.length,
    },
    {
      key: "normal",
      label: "NORMAL",
      icon: CheckCircle2,
      color: "text-risk-low",
      bgColor: "bg-risk-low-soft",
      count: categorized.normal.length,
    },
    {
      key: "completed",
      label: "COMPLETED",
      icon: Check,
      color: "text-muted-foreground",
      bgColor: "bg-muted/60",
      count: categorized.completed.length,
    },
  ];

  const filterContent = (
    <FilterControls
      riskFilter={riskFilter}
      setRiskFilter={setRiskFilter}
      chwFilter={chwFilter}
      setChwFilter={setChwFilter}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      houseFilter={houseFilter}
      setHouseFilter={setHouseFilter}
      datePreset={datePreset}
      setDatePreset={setDatePreset}
      dateFrom={dateFrom}
      setDateFrom={setDateFrom}
      dateTo={dateTo}
      setDateTo={setDateTo}
      chwOptions={chwOptions}
      houseOptions={houseOptions}
      isMobile={isMobile}
    />
  );

  /* ======================================================================== */
  /*                             RENDER                                       */
  /* ======================================================================== */

  return (
    <div className={cn("pb-8 space-y-5", animClass)}>
      {/* ================================================================ */}
      {/*  SUCCESS TOAST OVERLAY                                           */}
      {/* ================================================================ */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={cn(
            "ios-glass px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto",
            prefersReduced ? "" : "animate-in zoom-in-95 fade-in duration-300",
          )}>
            <div className="w-14 h-14 rounded-full bg-risk-low-soft flex items-center justify-center">
              <CheckCircle2 className="size-8 text-risk-low" />
            </div>
            <p className="font-display font-semibold text-foreground">
              {showSuccess === "completed" ? "Follow-up Completed" : "Follow-up Rescheduled"}
            </p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  1. PAGE HEADER                                                  */}
      {/* ================================================================ */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Follow-ups</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Track scheduled visits based on risk level. High risk requires a visit every 15 days, Moderate every 30 days, and Normal every 180 days.
            </p>
          </div>
          <div className="md:w-[300px] lg:w-[350px]">
            <FollowUpTarget completedTodayCount={completedTodayCount} />
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/*  2. STATUS NAVIGATION                                            */}
      {/* ================================================================ */}
      <nav
        className="grid grid-cols-4 gap-2"
        aria-label="Follow-up status categories"
      >
        {tabConfig.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-all duration-200 touch-target",
                "border",
                isActive
                  ? "bg-white border-primary/20 shadow-card"
                  : "bg-white/60 border-border/40 hover:bg-white hover:border-border",
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? t.bgColor : "bg-muted/60",
                )}
              >
                <Icon className={cn("size-4", isActive ? t.color : "text-muted-foreground")} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t.label}
              </span>
              <span
                className={cn(
                  "text-lg font-bold font-display",
                  isActive ? t.color : "text-foreground",
                )}
              >
                {t.count}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ================================================================ */}
      {/*  3. SEARCH + FILTERS                                             */}
      {/* ================================================================ */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name, member ID, house ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl bg-white border-border/60 h-11"
              aria-label="Search follow-ups"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {isMobile ? (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-border/60 shrink-0 touch-target"
                onClick={() => setShowMobileFilters(true)}
                aria-label="Open filters"
              >
                <Filter className="size-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </Button>
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-11 w-11 rounded-xl border-border/60 shrink-0 touch-target",
                      selectedCalDate && "bg-primary-soft text-primary border-primary/20"
                    )}
                    aria-label="Open calendar"
                  >
                    <CalendarDays className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 rounded-2xl ios-glass border-border/50 shadow-float" align="end">
                  <FollowUpCalendar
                    calMonth={calMonth}
                    calYear={calYear}
                    setCalMonth={setCalMonth}
                    setCalYear={setCalYear}
                    selectedDate={selectedCalDate}
                    onSelectDate={(d) => setSelectedCalDate(selectedCalDate === d ? null : d)}
                    followUpDateCounts={followUpDateCounts}
                    todayKey={todayKey}
                    onToday={() => {
                      setCalMonth(now.getMonth());
                      setCalYear(now.getFullYear());
                      setSelectedCalDate(todayKey);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-11 w-11 rounded-xl border-border/60 shrink-0 touch-target",
                    selectedCalDate && "bg-primary-soft text-primary border-primary/20"
                  )}
                  aria-label="Open calendar"
                >
                  <CalendarDays className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl ios-glass border-border/50 shadow-float" align="end">
                <FollowUpCalendar
                  calMonth={calMonth}
                  calYear={calYear}
                  setCalMonth={setCalMonth}
                  setCalYear={setCalYear}
                  selectedDate={selectedCalDate}
                  onSelectDate={(d) => setSelectedCalDate(selectedCalDate === d ? null : d)}
                  followUpDateCounts={followUpDateCounts}
                  todayKey={todayKey}
                  onToday={() => {
                    setCalMonth(now.getMonth());
                    setCalYear(now.getFullYear());
                    setSelectedCalDate(todayKey);
                  }}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Desktop Filters */}
        {!isMobile && (
          <div className="ios-glass p-4">
            {filterContent}
            {hasActiveFilters && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Showing {visibleItems.length} result{visibleItems.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Calendar date filter indicator */}
        {selectedCalDate && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-soft border border-primary/10", animClassFast)}>
            <CalendarDays className="size-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Filtered: {formatShortDate(selectedCalDate)}
            </span>
            <button
              onClick={() => setSelectedCalDate(null)}
              className="ml-auto text-primary/60 hover:text-primary transition-colors"
              aria-label="Clear date filter"
            >
              <XCircle className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* ============================================================== */}
        {/*  FOLLOW-UP LIST                                                 */}
        {/* ============================================================== */}
        <div className="space-y-3 min-w-0">
          {/* Result header */}
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              {selectedCalDate
                ? `Follow-ups · ${formatShortDate(selectedCalDate)}`
                : `${tabConfig.find((t) => t.key === tab)?.label} Follow-ups`}
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              {visibleItems.length} result{visibleItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Cards */}
          {visibleItems.length === 0 ? (
            <EmptyStateCard tab={tab} hasFilters={Boolean(hasActiveFilters)} />
          ) : (
            <div className="grid gap-3">
              {visibleItems.map((e, idx) => (
                <FollowUpCard
                  key={e.followUp.id}
                  item={e}
                  tab={tab}
                  todayKey={todayKey}
                  onComplete={() => setCompleteTarget(e)}
                  onReschedule={() => {
                    setRescheduleTarget(e);
                    setRescheduleDate("");
                  }}
                  animClass={animClass}
                  animDelay={prefersReduced ? 0 : Math.min(idx * 50, 300)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mobile calendar button */}
        {isMobile && (
          <Button
            variant="outline"
            className="w-full rounded-2xl h-12 border-border/60 font-semibold"
            onClick={() => setShowCalendar(true)}
          >
            <CalendarDays className="size-4 mr-2" />
            Open Calendar
          </Button>
        )}
      </div>

      {/* ================================================================ */}
      {/*  MOBILE FILTER DRAWER                                            */}
      {/* ================================================================ */}
      <Drawer open={showMobileFilters} onOpenChange={setShowMobileFilters}>
        <DrawerContent className="max-w-lg mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl">
          <div className="px-5 pb-8 pt-2 space-y-5 max-h-[80vh] overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary"
                >
                  Clear all
                </button>
              )}
            </div>
            {filterContent}
            <Button
              onClick={() => setShowMobileFilters(false)}
              className="w-full rounded-2xl h-12 font-semibold"
            >
              Apply Filters ({visibleItems.length} results)
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ================================================================ */}
      {/*  MOBILE CALENDAR DRAWER                                          */}
      {/* ================================================================ */}
      <Drawer open={isMobile && showCalendar} onOpenChange={setShowCalendar}>
        <DrawerContent className="max-w-lg mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl">
          <div className="px-5 pb-8 pt-2 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
            <FollowUpCalendar
              calMonth={calMonth}
              calYear={calYear}
              setCalMonth={setCalMonth}
              setCalYear={setCalYear}
              selectedDate={selectedCalDate}
              onSelectDate={(d) => {
                setSelectedCalDate(selectedCalDate === d ? null : d);
                setShowCalendar(false);
              }}
              followUpDateCounts={followUpDateCounts}
              todayKey={todayKey}
              onToday={() => {
                setCalMonth(now.getMonth());
                setCalYear(now.getFullYear());
                setSelectedCalDate(todayKey);
                setShowCalendar(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* ================================================================ */}
      {/*  COMPLETE DIALOG                                                 */}
      {/* ================================================================ */}
      <Dialog open={Boolean(completeTarget)} onOpenChange={(open) => !open && setCompleteTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border/50 ios-glass">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Complete Follow-up</DialogTitle>
            <DialogDescription>
              Optional: Enter new vitals to recalculate member risk.
            </DialogDescription>
          </DialogHeader>
          {completeTarget && (
            <div className="space-y-4 py-2">
              <InfoRow label="Member" value={completeTarget.member?.name ?? "—"} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Systolic BP</label>
                  <Input 
                    type="number"
                    value={completeSystolic}
                    onChange={(e) => setCompleteSystolic(e.target.value)}
                    placeholder={completeTarget.member?.systolic?.toString() || ""}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Diastolic BP</label>
                  <Input 
                    type="number"
                    value={completeDiastolic}
                    onChange={(e) => setCompleteDiastolic(e.target.value)}
                    placeholder={completeTarget.member?.diastolic?.toString() || ""}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Blood Sugar (RBS)</label>
                <Input 
                  type="number"
                  value={completeSugar}
                  onChange={(e) => setCompleteSugar(e.target.value)}
                  placeholder={completeTarget.member?.bloodSugar?.toString() || ""}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                if (completeTarget) {
                  completeMutation.mutate({ id: completeTarget.followUp.id, holidays });
                }
              }}
              disabled={completeMutation.isPending}
              className="rounded-xl font-semibold flex-1 uppercase tracking-wider"
            >
              SKIP VITALS
            </Button>
            <Button
              onClick={() => {
                if (completeTarget) {
                  const sys = parseInt(completeSystolic);
                  const dia = parseInt(completeDiastolic);
                  const sug = completeSugar ? parseInt(completeSugar) : null;
                  if (!isNaN(sys) && !isNaN(dia)) {
                    completeMutation.mutate({
                      id: completeTarget.followUp.id,
                      vitals: { systolic: sys, diastolic: dia, bloodSugar: sug },
                      holidays
                    });
                  } else {
                    toast.error("Please enter both Systolic and Diastolic BP, or skip.");
                  }
                }
              }}
              disabled={completeMutation.isPending}
              className="rounded-xl font-semibold flex-1 uppercase tracking-wider"
            >
              {completeMutation.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              ) : (
                <Check className="size-4 mr-2" />
              )}
              SAVE VITALS & COMPLETE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/*  RESCHEDULE DIALOG                                               */}
      {/* ================================================================ */}
      <Dialog open={Boolean(rescheduleTarget)} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border/50 ios-glass">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Reschedule Follow-up</DialogTitle>
            <DialogDescription>
              Choose a new date for this follow-up.
            </DialogDescription>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4 py-2">
              <InfoRow label="Member" value={rescheduleTarget.member?.name ?? "—"} />
              <InfoRow
                label="Current Date"
                value={rescheduleTarget.followUp.due_date ? formatShortDate(rescheduleTarget.followUp.due_date) : "—"}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="reschedule-date">
                  New Date
                </label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={todayKey}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setRescheduleTarget(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (rescheduleTarget && rescheduleDate) {
                  rescheduleMutation.mutate({
                    id: rescheduleTarget.followUp.id,
                    date: new Date(rescheduleDate + "T12:00:00"),
                  });
                }
              }}
              disabled={rescheduleMutation.isPending || !rescheduleDate}
              className="rounded-xl font-semibold"
            >
              {rescheduleMutation.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              ) : (
                <CalendarClock className="size-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/*                       FOLLOW-UP CARD COMPONENT                             */
/* ========================================================================== */

function FollowUpCard({
  item,
  tab,
  todayKey,
  onComplete,
  onReschedule,
  animClass,
  animDelay,
}: {
  item: EnrichedFollowUp;
  tab: StatusTab;
  todayKey: string;
  onComplete: () => void;
  onReschedule: () => void;
  animClass: string;
  animDelay: number;
}) {
  const { followUp: f, member, house, assignedChwName, daysOverdue, statusLabel } = item;
  const risk = asRisk(f.risk_level ?? member?.risk ?? "low");
  const isOverdue = daysOverdue > 0;
  const isPending = (f.status ?? "pending") === "pending";

  const assessmentDate = member?.screenedAt ? formatShortDate(member.screenedAt) : "—";
  const lastFollowUpDate = f.updated_at ? formatShortDate(f.updated_at.split("T")[0]!) : (f.created_at ? formatShortDate(f.created_at.split("T")[0]!) : "—");
  const nextFollowUpDate = f.due_date ? formatShortDate(f.due_date) : "—";

  return (
    <div
      className={cn(
        "ios-glass p-5 space-y-4 transition-all hover:shadow-float group relative overflow-hidden",
        animClass,
      )}
      style={{ animationDelay: `${animDelay}ms` }}
      role="article"
      aria-label={`Follow-up for ${member?.name ?? "Unknown"}`}
    >
      {/* Decorative risk accent line */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1.5",
        risk === "high" ? "bg-risk-high" : risk === "moderate" ? "bg-risk-moderate" : "bg-risk-low"
      )} />

      {/* Header: Member Name & Risk Badge */}
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-foreground text-base truncate">
            {member?.name ?? "Unknown Member"}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {member?.age != null && <span>Age {member.age}</span>}
            <span className="inline-flex items-center gap-1 font-mono uppercase">
              <Home className="size-3" />
              {house?.house?.house_number ?? house?.house?.house_id ?? "—"}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <RiskBadge level={risk} />
          {isOverdue && (
             <p className="text-[10px] font-bold text-risk-high mt-1 uppercase tracking-wider">
               {daysOverdue} day{daysOverdue > 1 ? "s" : ""} overdue
             </p>
          )}
        </div>
      </div>

      {/* Reason for Follow-up */}
      {(f.reason || (f.status && f.status !== "pending")) && (
        <div className="pl-2">
           <span className="inline-block px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
              {f.reason ? f.reason : `Status: ${f.status}`}
           </span>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-border/40 ml-2" />

      {/* Critical Dates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-2">
        <div className="flex flex-col bg-surface-muted/50 p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assessment</span>
          <span className="text-sm font-medium text-foreground mt-0.5 truncate">{assessmentDate}</span>
        </div>
        <div className="flex flex-col bg-surface-muted/50 p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last Follow-up</span>
          <span className="text-sm font-medium text-foreground mt-0.5 truncate">{lastFollowUpDate}</span>
        </div>
        <div className={cn(
          "flex flex-col p-2.5 rounded-xl border",
          isOverdue ? "bg-risk-high-soft/30 border-risk-high/30" : f.due_date === todayKey ? "bg-info-soft/30 border-info/30" : "bg-primary-soft/30 border-primary/20"
        )}>
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            isOverdue ? "text-risk-high" : f.due_date === todayKey ? "text-info" : "text-primary"
          )}>Next Follow-up</span>
          <span className={cn(
            "text-sm font-bold mt-0.5 truncate",
            isOverdue ? "text-risk-high" : f.due_date === todayKey ? "text-info" : "text-primary"
          )}>{nextFollowUpDate}</span>
        </div>
      </div>

      {/* Vitals & Assigned CHW */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2 mt-2">
        {member?.systolic != null && member.diastolic != null ? (
          <div className="flex items-center gap-1.5 bg-background/50 px-2.5 py-1 rounded-lg border border-border/40 shadow-xs">
            <Activity className="size-3.5 text-risk-high" />
            <span className="text-xs font-semibold text-foreground">
              {member.systolic}/{member.diastolic} <span className="text-[10px] font-normal text-muted-foreground">mmHg</span>
            </span>
          </div>
        ) : null}
        {member?.bloodSugar != null ? (
          <div className="flex items-center gap-1.5 bg-background/50 px-2.5 py-1 rounded-lg border border-border/40 shadow-xs">
            <Droplets className="size-3.5 text-risk-moderate" />
            <span className="text-xs font-semibold text-foreground">
              {member.bloodSugar} <span className="text-[10px] font-normal text-muted-foreground">mg/dL</span>
            </span>
          </div>
        ) : null}
        {assignedChwName && (
          <div className="flex items-center gap-1.5 ml-auto bg-background/50 px-2.5 py-1 rounded-lg border border-border/40">
            <User className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{assignedChwName}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/40 pl-2">
        {member && (
          <Link
            to="/members/$memberId"
            params={{ memberId: member.id }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-muted px-4 py-2.5 text-xs font-bold text-foreground hover:bg-secondary transition-colors touch-target shadow-xs border border-border/50 active:scale-95"
          >
            <User className="size-4" />
            View Member
          </Link>
        )}
        {isPending && (
          <>
            <Button
              onClick={onComplete}
              className="rounded-xl font-bold text-xs h-10 px-4 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all ml-auto"
            >
              <Check className="size-4 mr-1.5 stroke-[3]" />
              Complete
            </Button>
            <Button
              variant="outline"
              onClick={onReschedule}
              className="rounded-xl text-xs font-bold h-10 px-4 active:scale-95 transition-all shadow-xs"
            >
              <CalendarClock className="size-4 mr-1.5" />
              Reschedule
            </Button>
          </>
        )}
        {!isPending && (
          <span className="text-xs text-muted-foreground font-bold ml-auto px-3 py-1.5 bg-muted/50 rounded-lg">
            {(f.status ?? "pending").toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                              CALENDAR                                      */
/* ========================================================================== */

function FollowUpCalendar({
  calMonth,
  calYear,
  setCalMonth,
  setCalYear,
  selectedDate,
  onSelectDate,
  followUpDateCounts,
  todayKey,
  onToday,
}: {
  calMonth: number;
  calYear: number;
  setCalMonth: (m: number) => void;
  setCalYear: (y: number) => void;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  followUpDateCounts: Map<string, number>;
  todayKey: string;
  onToday: () => void;
}) {
  const days = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);
  const monthName = new Date(calYear, calMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  return (
    <div className="ios-glass p-4 space-y-3" role="region" aria-label="Follow-up calendar">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors touch-target"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h3 className="font-display font-semibold text-sm text-foreground">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors touch-target"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Today Button */}
      <button
        onClick={onToday}
        className="w-full text-center text-xs font-semibold text-primary hover:text-primary/80 py-1 transition-colors"
      >
        Today
      </button>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, idx) => {
          const key = toDateKey(day);
          const isCurrentMonth = day.getMonth() === calMonth;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const count = followUpDateCounts.get(key) ?? 0;
          const hasFollowUps = count > 0;

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(key)}
              aria-label={`${day.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${count > 0 ? `, ${count} follow-ups` : ""}`}
              aria-pressed={isSelected}
              className={cn(
                "relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-all",
                "hover:bg-muted/60",
                !isCurrentMonth && "opacity-30",
                isToday && !isSelected && "bg-accent font-bold text-accent-foreground",
                isSelected && "bg-primary text-primary-foreground font-bold shadow-xs",
                !isToday && !isSelected && "text-foreground",
              )}
            >
              <span>{day.getDate()}</span>
              {hasFollowUps && (
                <span
                  className={cn(
                    "absolute bottom-0.5 w-1 h-1 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-primary",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Clear date filter */}
      {selectedDate && (
        <button
          onClick={() => onSelectDate(selectedDate)}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground py-1 transition-colors border-t border-border/30 pt-2"
        >
          Clear Date Filter
        </button>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                           FILTER CONTROLS                                  */
/* ========================================================================== */

function FilterControls({
  riskFilter,
  setRiskFilter,
  chwFilter,
  setChwFilter,
  statusFilter,
  setStatusFilter,
  houseFilter,
  setHouseFilter,
  datePreset,
  setDatePreset,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  chwOptions,
  houseOptions,
  isMobile,
}: {
  riskFilter: string;
  setRiskFilter: (v: string) => void;
  chwFilter: string;
  setChwFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  houseFilter: string;
  setHouseFilter: (v: string) => void;
  datePreset: string;
  setDatePreset: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  chwOptions: { id: string; name: string }[];
  houseOptions: { id: string; label: string }[];
  isMobile: boolean;
}) {
  return (
    <div className={cn("gap-3", isMobile ? "space-y-3" : "grid grid-cols-3 lg:grid-cols-6")}>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Risk
        </label>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="h-9 rounded-lg text-xs" aria-label="Filter by risk">
            <SelectValue placeholder="All Risks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 rounded-lg text-xs" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          CHW / CSW
        </label>
        <Select value={chwFilter} onValueChange={setChwFilter}>
          <SelectTrigger className="h-9 rounded-lg text-xs" aria-label="Filter by CHW">
            <SelectValue placeholder="All CHWs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All CHWs</SelectItem>
            {chwOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          House
        </label>
        <Select value={houseFilter} onValueChange={setHouseFilter}>
          <SelectTrigger className="h-9 rounded-lg text-xs" aria-label="Filter by house">
            <SelectValue placeholder="All Houses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Houses</SelectItem>
            {houseOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Date
        </label>
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="h-9 rounded-lg text-xs" aria-label="Filter by date">
            <SelectValue placeholder="All Dates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {datePreset === "custom" && (
        <div className={cn("space-y-1", isMobile ? "" : "col-span-2 lg:col-span-1")}>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Range
          </label>
          <div className="flex gap-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg text-xs flex-1"
              aria-label="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg text-xs flex-1"
              aria-label="To date"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                           EMPTY STATES                                     */
/* ========================================================================== */

function EmptyStateCard({ tab, hasFilters }: { tab: StatusTab; hasFilters: boolean }) {
  const config: Record<StatusTab, { title: string; description: string; icon: typeof CalendarDays }> = {
    high: {
      title: "No High Risk follow-ups found",
      description: hasFilters
        ? "Try adjusting your filters to see more results."
        : "There are no high risk follow-ups currently scheduled.",
      icon: AlertTriangle,
    },
    moderate: {
      title: "No Moderate Risk follow-ups found",
      description: hasFilters
        ? "Try adjusting your filters to see more results."
        : "There are no moderate risk follow-ups currently scheduled.",
      icon: Clock,
    },
    normal: {
      title: "No Normal follow-ups found",
      description: hasFilters
        ? "Try adjusting your filters to see more results."
        : "There are no normal risk follow-ups currently scheduled.",
      icon: CheckCircle2,
    },
    completed: {
      title: "No completed follow-ups yet",
      description: hasFilters
        ? "Try adjusting your filters to see more results."
        : "Completed follow-ups will appear here after visits are marked done.",
      icon: CheckCircle2,
    },
  };
  const c = config[tab];
  const Icon = c.icon;

  return (
    <div className="ios-glass flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">{c.title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{c.description}</p>
    </div>
  );
}

/* ========================================================================== */
/*                           INFO ROW                                         */
/* ========================================================================== */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-xs font-semibold text-foreground">{typeof value === "string" ? value : value}</span>
    </div>
  );
}

/* ========================================================================== */
/*                          SKELETON COMPONENTS                               */
/* ========================================================================== */

function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <div className="h-7 bg-border/40 rounded-lg w-36 animate-pulse" />
      <div className="h-4 bg-border/30 rounded w-64 animate-pulse" />
      <div className="h-3 bg-border/20 rounded w-44 animate-pulse" />
    </div>
  );
}

function SkeletonStatusNav() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-border/40 p-3 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-border/30 mx-auto animate-pulse" />
          <div className="h-3 bg-border/30 rounded w-14 mx-auto animate-pulse" />
          <div className="h-5 bg-border/40 rounded w-8 mx-auto animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function SkeletonFilters() {
  return (
    <div className="space-y-3">
      <div className="h-11 bg-border/30 rounded-xl animate-pulse" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="ios-glass p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1">
          <div className="h-3 bg-border/30 rounded w-28 animate-pulse" />
          <div className="h-3 bg-border/20 rounded w-52 animate-pulse" />
        </div>
        <div className="h-8 w-16 bg-border/30 rounded-lg animate-pulse" />
      </div>
      <div className="h-px bg-border/20" />
      <div className="flex items-center gap-3">
        <div className="h-4 bg-border/30 rounded w-32 animate-pulse" />
        <div className="h-5 w-16 bg-border/20 rounded-full animate-pulse ml-auto" />
      </div>
      <div className="flex gap-3">
        <div className="h-3 bg-border/20 rounded w-20 animate-pulse" />
        <div className="h-3 bg-border/20 rounded w-20 animate-pulse" />
      </div>
      <div className="h-px bg-border/20" />
      <div className="flex gap-2">
        <div className="h-8 bg-border/20 rounded-xl w-24 animate-pulse" />
        <div className="h-8 bg-border/30 rounded-xl w-20 animate-pulse" />
        <div className="h-8 bg-border/20 rounded-xl w-24 animate-pulse" />
      </div>
    </div>
  );
}
