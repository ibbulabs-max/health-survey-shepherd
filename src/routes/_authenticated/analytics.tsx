import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Calendar,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnalyticsCandle } from "@/components/analytics/AnalyticsCandle";
import { CandleRail } from "@/components/analytics/CandleRail";
import { AnalyticsMemberPanel } from "@/components/analytics/AnalyticsMemberPanel";
import { GlobalFilterSheet } from "@/components/common/GlobalFilterSheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AnalyticsSettingsDrawer, defaultPreferences, type AnalyticsPreferences } from "@/components/analytics/AnalyticsSettingsDrawer";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { updateAnalyticsPreferences } from "@/services/userService";
import { cn } from "@/lib/utils";
import { useAnalyticsDashboard, useCreateDashboard } from "@/hooks/useAnalyticsDashboard";
import { DashboardEngine } from "@/components/analytics/DashboardEngine";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics Dashboard — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Executive Apple-style analytics with exact-value candle visualizations, universal filtering, and real-time database sync.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { analytics, filters, setFilter, clearFilter, clearAllFilters, isLoading, error, refetch } =
    useAnalytics();

  const { role, isAdmin, user, refresh } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [ageMode, setAgeMode] = useState<"exact" | "binned">("exact");
  const [isEditMode, setIsEditMode] = useState(false);

  const preferences: AnalyticsPreferences = {
    ...defaultPreferences,
    ...(user?.profile?.analytics_preferences as unknown as AnalyticsPreferences),
  };

  const { data: dashboardConfig, isLoading: isLoadingConfig } = useAnalyticsDashboard();
  const createDashboard = useCreateDashboard();

  if (isLoading || !analytics) return <LoadingState label="Crunching real database analytics…" />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Could not load analytics data."}
        onRetry={() => void refetch()}
      />
    );
  }

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      await refetch();
      toast.success("Analytics synced with real database records.");
    } catch {
      toast.error("Failed to sync analytics.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to check if a specific filter is currently active on a candle
  const isCandleActive = (key: keyof typeof filters, val: string | number) => {
    return filters[key] === val;
  };

  const handleCandleClick = (key: keyof typeof filters, val: string | number) => {
    if (filters[key] === val) {
      clearFilter(key);
    } else {
      setFilter(key, val);
      setShowRightPanel(true);
      if (typeof window !== "undefined" && window.innerWidth < 1280) {
        setMobileDrawerOpen(true);
      }
    }
  };

  const isScopeSelectable = isAdmin || role === "supervisor";

  return (
    <div className="space-y-5 max-w-[1680px] mx-auto pb-16 px-2 sm:px-4">
      {/* ------------------------------------------------------------------------ */}
      {/* 1. TOP HEADER & FILTER BAR                                               */}
      {/* ------------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4">
        {/* Title & Sync Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Analytics Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Last Sync:{" "}
              {new Date().toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              , 10:30 AM
            </span>
            <button
              type="button"
              onClick={handleSyncData}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs font-semibold bg-surface border border-border/70 hover:bg-surface-muted px-3 py-2 rounded-xl transition-all shadow-xs text-foreground"
            >
              <RefreshCw className={cn("size-3.5 text-primary", isSyncing && "animate-spin")} />
              <span>Sync Data</span>
            </button>
          </div>
        </div>

        {/* Filters & KPI Summary Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Top Left Filters */}
          <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
            <GlobalFilterSheet />

            {/* Date Range Badge */}
            <div className="flex items-center gap-1.5 bg-surface text-xs font-medium px-3 py-2 rounded-xl border border-border/70 shadow-xs text-foreground">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>01 May 2025 - 30 May 2025</span>
            </div>

            {/* More Filters button */}
            <button
              type="button"
              onClick={() => setShowRightPanel((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-surface border border-border/70 hover:bg-surface-muted px-3 py-2 rounded-xl transition-all shadow-xs text-foreground"
            >
              <SlidersHorizontal className="size-3 text-muted-foreground" />
              <span>More Filters</span>
            </button>

            {/* Customize / Edit Layout Button */}
            {isScopeSelectable && (
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold border px-3 py-2 rounded-xl transition-all shadow-xs",
                  isEditMode 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-surface border-border/70 hover:bg-surface-muted text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3" />
                <span>{isEditMode ? "Exit Edit Mode" : "Edit Layout"}</span>
              </button>
            )}

            {/* Reset Button */}
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Top Right 4 Compact KPI Cards */}
          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Total Members */}
            <div className="bg-surface rounded-2xl border border-border/70 shadow-xs p-3 flex flex-col justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Total Members</p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-display text-lg font-bold text-foreground">
                  {(analytics.kpi?.totalMembers ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  100%
                </span>
              </div>
            </div>

            {/* High Risk */}
            <div className="bg-surface rounded-2xl border border-border/70 shadow-xs p-3 flex flex-col justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">High Risk</p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-display text-lg font-bold text-foreground">
                  {(analytics.kpi?.highRisk ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                  {analytics.kpi.highRiskPct}%
                </span>
              </div>
            </div>

            {/* Follow-ups */}
            <div className="bg-surface rounded-2xl border border-border/70 shadow-xs p-3 flex flex-col justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Follow-ups</p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-display text-lg font-bold text-foreground">
                  {(analytics.kpi?.followUps ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                  {analytics.kpi.followUpsPct}%
                </span>
              </div>
            </div>

            {/* Referrals */}
            <div className="bg-surface rounded-2xl border border-border/70 shadow-xs p-3 flex flex-col justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Referrals</p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-display text-lg font-bold text-foreground">
                  {(analytics.kpi?.referrals ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                  {analytics.kpi.referralsPct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------ */}
      {/* 2. MAIN ANALYTICS GRID & RIGHT-SIDE MEMBER PANEL                         */}
      {/* ------------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left / Main Analytics Cards (Spans 8 or 12 columns) */}
        <main
          className={cn(
            "space-y-4 transition-all duration-300",
            showRightPanel ? "xl:col-span-8" : "xl:col-span-12",
          )}
        >
          {dashboardConfig ? (
            <DashboardEngine 
              dashboard={dashboardConfig}
              analyticsData={analytics}
              filters={filters}
              isEditMode={isEditMode}
              handleCandleClick={handleCandleClick as any}
              isCandleActive={isCandleActive as any}
            />
          ) : (
            <div className="flex flex-col">
              {isEditMode && (
                 <div className="bg-surface border-2 border-dashed border-primary/40 rounded-3xl p-8 mb-6 flex flex-col items-center justify-center text-center">
                   <h3 className="font-display text-lg font-bold text-foreground mb-2">No Custom Dashboard Found</h3>
                   <p className="text-muted-foreground text-sm max-w-md mb-4">
                     You are currently viewing the default hardcoded layout. Would you like to initialize a new custom dashboard?
                   </p>
                   <button
                     onClick={async () => {
                       try {
                         await createDashboard.mutateAsync({ 
                           name: "System Dashboard",
                           roleDefault: "survey_user"
                         });
                         toast.success("Initialized custom dashboard!");
                       } catch (e: any) {
                         toast.error("Failed to initialize dashboard.");
                       }
                     }}
                     disabled={createDashboard.isPending}
                     className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl shadow-md text-sm disabled:opacity-70"
                   >
                     {createDashboard.isPending ? "Initializing..." : "Initialize Custom Dashboard"}
                   </button>
                 </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Age Analytics */}
            {preferences.showAge && (
              <CandleRail
                title={ageMode === "exact" ? "AGE ANALYTICS (EXACT)" : "AGE ANALYTICS (GROUPS)"}
                unit={ageMode === "exact" ? "Years" : "Bins"}
                infoTooltip={
                  ageMode === "exact"
                    ? "Exact age breakdown for distinct ages in real data."
                    : "Standard epidemiological age groups."
                }
                onViewMembers={() => {
                  setShowRightPanel(true);
                  if (typeof window !== "undefined" && window.innerWidth < 1280)
                    setMobileDrawerOpen(true);
                }}
                hasData={
                  ageMode === "exact" ? analytics.ages.length > 0 : analytics.binnedAges.length > 0
                }
                className="md:col-span-6"
              >
                <div className="absolute top-3.5 right-28 hidden sm:flex items-center gap-1 bg-surface-muted/80 p-0.5 rounded-lg border border-border/60 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setAgeMode("exact")}
                    className={cn(
                      "px-2 py-0.5 rounded-md transition-all",
                      ageMode === "exact"
                        ? "bg-surface text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgeMode("binned")}
                    className={cn(
                      "px-2 py-0.5 rounded-md transition-all",
                      ageMode === "binned"
                        ? "bg-surface text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Groups
                  </button>
                </div>

                {(() => {
                  const list = ageMode === "exact" ? analytics.ages : analytics.binnedAges;
                  const max = Math.max(1, ...list.map((a) => a.count));
                  return list.map((a) => (
                    <AnalyticsCandle
                      key={String(a.value)}
                      label={a.label}
                      count={a.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone="blue"
                      candleWidth={ageMode === "binned" ? "w-10 sm:w-12" : "w-4 sm:w-5"}
                      isSelected={
                        ageMode === "exact"
                          ? isCandleActive("age", a.value)
                          : isCandleActive("binnedAge", a.value)
                      }
                      onClick={() => {
                        if (ageMode === "exact") {
                          handleCandleClick("age", a.value);
                        } else {
                          handleCandleClick("binnedAge", a.value);
                        }
                      }}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Gender Analytics */}
            {preferences.showGender && (
              <CandleRail
                title="GENDER ANALYTICS"
                infoTooltip="Normalized gender breakdown (Male, Female, Other)."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.genders.length > 0}
                className="md:col-span-3"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.genders.map((g) => g.count));
                  return analytics.genders.map((g) => (
                    <AnalyticsCandle
                      key={String(g.value)}
                      label={g.label}
                      count={g.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone="purple"
                      candleWidth="w-7 sm:w-8"
                      isSelected={isCandleActive("gender", g.value)}
                      onClick={() => handleCandleClick("gender", g.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Risk Analytics */}
            {preferences.showRisk && (
              <CandleRail
                title="RISK ANALYTICS"
                infoTooltip="Clinical risk classification distribution."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.risks.length > 0}
                className="md:col-span-3"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.risks.map((r) => r.count));
                  return analytics.risks.map((r) => (
                    <AnalyticsCandle
                      key={String(r.value)}
                      label={r.label}
                      count={r.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone={r.tone}
                      candleWidth="w-7 sm:w-8"
                      isSelected={isCandleActive("risk", r.value as any)}
                      onClick={() => handleCandleClick("risk", r.value as any)}
                    />
                  ));
                })()}
              </CandleRail>
            )}
          </div>

          {/* ----------------- ROW 2: BP + SUGAR + BMI ----------------- */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* BP Analytics (mmHg) */}
            {preferences.showBP && (
              <CandleRail
                title="BP ANALYTICS"
                unit="mmHg"
                infoTooltip="Exact blood pressure readings (Systolic/Diastolic)."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.bps.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.bps.map((b) => b.count));
                  return analytics.bps.map((b) => (
                    <AnalyticsCandle
                      key={String(b.value)}
                      label={b.label}
                      count={b.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone={b.tone}
                      isSelected={isCandleActive("bp", b.value)}
                      onClick={() => handleCandleClick("bp", b.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Sugar Analytics (mg/dL) */}
            {preferences.showSugar && (
              <CandleRail
                title="SUGAR ANALYTICS"
                unit="mg/dL"
                infoTooltip="Exact Random Blood Sugar readings (mg/dL)."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.sugars.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.sugars.map((s) => s.count));
                  return analytics.sugars.map((s) => (
                    <AnalyticsCandle
                      key={String(s.value)}
                      label={s.label}
                      count={s.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone={s.tone}
                      isSelected={isCandleActive("sugar", Number(s.value))}
                      onClick={() => handleCandleClick("sugar", Number(s.value))}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* BMI Analytics (kg/m²) */}
            {preferences.showBMI && (
              <CandleRail
                title="BMI ANALYTICS"
                unit="kg/m²"
                infoTooltip="Body Mass Index categories derived from height and weight."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.bmis.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.bmis.map((bm) => bm.count));
                  return analytics.bmis.map((bm) => (
                    <AnalyticsCandle
                      key={String(bm.value)}
                      label={bm.label}
                      count={bm.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone={bm.tone}
                      isSelected={isCandleActive("bmiCategory", bm.value)}
                      onClick={() => handleCandleClick("bmiCategory", bm.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}
          </div>

          {/* ----------------- ROW 3: KNOWN CONDITIONS + LIFESTYLE + CLINICAL RISK ----------------- */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Known Conditions */}
            {preferences.showConditions && (
              <CandleRail
                title="KNOWN CONDITIONS"
                infoTooltip="Prevalence of individual diagnosed medical conditions."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.conditions.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.conditions.map((c) => c.count));
                  return analytics.conditions.map((c) => (
                    <AnalyticsCandle
                      key={String(c.value)}
                      label={c.label}
                      count={c.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone="blue"
                      isSelected={isCandleActive("condition", c.value)}
                      onClick={() => handleCandleClick("condition", c.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Lifestyle Analytics */}
            {preferences.showLifestyle && (
              <CandleRail
                title="LIFESTYLE ANALYTICS"
                infoTooltip="Key behavioral and lifestyle risk factors."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.lifestyle.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.lifestyle.map((l) => l.count));
                  return analytics.lifestyle.map((l) => (
                    <AnalyticsCandle
                      key={String(l.value)}
                      label={l.label}
                      count={l.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone="orange"
                      isSelected={isCandleActive("lifestyleKey", l.value)}
                      onClick={() => handleCandleClick("lifestyleKey", l.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Clinical Risk Level */}
            {preferences.showClinicalRisk && (
              <CandleRail
                title="CLINICAL RISK LEVEL"
                infoTooltip="High, Moderate, and Low risk summary."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.risks.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.risks.map((r) => r.count));
                  return analytics.risks.map((r) => (
                    <AnalyticsCandle
                      key={`risk-lvl-${r.value}`}
                      label={r.label.replace(" Risk", "")}
                      count={r.count}
                      maxCount={max}
                      totalCount={analytics.kpi.totalMembers}
                      tone={r.tone}
                      candleWidth="w-7 sm:w-8"
                      isSelected={isCandleActive("risk", r.value as any)}
                      onClick={() => handleCandleClick("risk", r.value as any)}
                    />
                  ));
                })()}
              </CandleRail>
            )}
          </div>

          {/* ----------------- ROW 4: FOLLOW-UP + REFERRAL + ASSESSMENT ----------------- */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Follow-up Status */}
            {preferences.showFollowUp && (
              <CandleRail
                title="FOLLOW-UP STATUS"
                infoTooltip="Scheduled and overdue follow-up health visits."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.followUps.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.followUps.map((f) => f.count));
                  return analytics.followUps.map((f) => (
                    <AnalyticsCandle
                      key={String(f.value)}
                      label={f.label}
                      count={f.count}
                      maxCount={max}
                      tone={f.tone}
                      isSelected={isCandleActive("followUpStatus", f.value)}
                      onClick={() => handleCandleClick("followUpStatus", f.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Referral Status */}
            {preferences.showReferral && (
              <CandleRail
                title="REFERRAL STATUS"
                infoTooltip="Specialist and tertiary hospital referrals."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.referrals.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.referrals.map((r) => r.count));
                  return analytics.referrals.map((r) => (
                    <AnalyticsCandle
                      key={String(r.value)}
                      label={r.label}
                      count={r.count}
                      maxCount={max}
                      tone={r.tone}
                      isSelected={isCandleActive("referralStatus", r.value)}
                      onClick={() => handleCandleClick("referralStatus", r.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Assessment Status */}
            {preferences.showAssessment && (
              <CandleRail
                title="ASSESSMENT STATUS"
                infoTooltip="Coverage status of member clinical assessments."
                onViewMembers={() => setShowRightPanel(true)}
                hasData={analytics.assessments.length > 0}
                className="md:col-span-4"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.assessments.map((asst) => asst.count));
                  return analytics.assessments.map((asst) => (
                    <AnalyticsCandle
                      key={String(asst.value)}
                      label={asst.label}
                      count={asst.count}
                      maxCount={max}
                      tone={asst.tone}
                      isSelected={isCandleActive("assessmentStatus", asst.value)}
                      onClick={() => handleCandleClick("assessmentStatus", asst.value)}
                    />
                  ));
                })()}
              </CandleRail>
            )}
          </div>

          {/* ----------------- ROW 5: MONTHLY TRENDS + DATA QUALITY ----------------- */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Monthly Trends (Assessments) */}
            {preferences.showTrends && (
              <CandleRail
                title="MONTHLY TRENDS"
                unit="Assessments"
                infoTooltip="Number of screenings completed per calendar month."
                hasData={analytics.trends.length > 0}
                className="md:col-span-7"
              >
                {(() => {
                  const max = Math.max(1, ...analytics.trends.map((t) => t.count));
                  return analytics.trends.map((t) => (
                    <AnalyticsCandle
                      key={String(t.value)}
                      label={t.label}
                      count={t.count}
                      maxCount={max}
                      tone="teal"
                    />
                  ));
                })()}
              </CandleRail>
            )}

            {/* Data Quality Summary */}
            <div className="md:col-span-5 bg-surface rounded-2xl border border-border/70 shadow-xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-display text-[13px] font-bold tracking-wider uppercase text-foreground">
                  DATA QUALITY SUMMARY
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRightPanel(true)}
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full transition-colors"
                >
                  View Details
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "missing_bp")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "missing_bp" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Missing BP</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality?.missingBp ?? 0).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "missing_sugar")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "missing_sugar" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Missing Sugar</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality?.missingSugar ?? 0).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "missing_age")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "missing_age" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Missing Age</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality?.missingAge ?? 0).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "missing_gender")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "missing_gender" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Missing Gender</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality?.missingGender ?? 0).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "invalid")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "invalid" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Invalid Records</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality?.invalidRecords ?? 0).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "missing_height")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "missing_height" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Missing Height</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality.missingHeight ?? 0).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCandleClick("dataQuality", "missing_weight")}
                  className={cn(
                    "p-2 rounded-xl bg-surface-muted/50 hover:bg-surface-muted text-center transition-colors border border-border/40",
                    filters.dataQuality === "missing_weight" && "ring-1 ring-primary",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground truncate">Missing Weight</p>
                  <p className="font-display text-sm font-bold text-foreground mt-0.5">
                    {(analytics.quality.missingWeight ?? 0).toLocaleString()}
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* ----------------- DYNAMIC DISCOVERY CATEGORIES ----------------- */}
          {analytics.dynamicCategories && analytics.dynamicCategories.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="font-display text-sm font-bold tracking-tight text-foreground uppercase">
                  Dataset Discovered Dimensions
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {analytics.dynamicCategories.map((cat) => (
                  <CandleRail
                    key={cat.key}
                    title={cat.title}
                    infoTooltip="Dynamic dimension discovered from imported dataset fields."
                    onViewMembers={() => {
                      setShowRightPanel(true);
                      if (typeof window !== "undefined" && window.innerWidth < 1280)
                        setMobileDrawerOpen(true);
                    }}
                    hasData={cat.items.length > 0}
                    className="md:col-span-6"
                  >
                    {(() => {
                      const max = Math.max(1, ...cat.items.map((it) => it.count));
                      return cat.items.map((it) => (
                        <AnalyticsCandle
                          key={String(it.value)}
                          label={it.label}
                          count={it.count}
                          maxCount={max}
                          totalCount={analytics.kpi.totalMembers}
                          tone={it.tone}
                          isSelected={
                            filters.extraField?.key === cat.key &&
                            filters.extraField?.value === String(it.value)
                          }
                          onClick={() => {
                            if (
                              filters.extraField?.key === cat.key &&
                              filters.extraField?.value === String(it.value)
                            ) {
                              clearFilter("extraField");
                            } else {
                              setFilter("extraField", { key: cat.key, value: String(it.value) });
                              setShowRightPanel(true);
                              if (typeof window !== "undefined" && window.innerWidth < 1280)
                                setMobileDrawerOpen(true);
                            }
                          }}
                        />
                      ));
                    })()}
                  </CandleRail>
                ))}
              </div>
             </div>
          )}
          </div>
         )}
        </main>

        {/* Right / Filtered Member List Panel (Desktop Rail) */}
        {showRightPanel && (
          <aside className="hidden xl:block xl:col-span-4 sticky top-4">
            <AnalyticsMemberPanel
              members={analytics.filteredMembers}
              filters={filters}
              onClearFilter={clearFilter}
              onClearAll={clearAllFilters}
              onSearchChange={(q) => setFilter("search", q)}
              onClose={() => setShowRightPanel(false)}
            />
          </aside>
        )}
      </div>

      {/* Mobile Drilldown Slide-up Drawer */}
      <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <DrawerContent className="max-h-[85vh] p-4 rounded-t-3xl bg-background/95 backdrop-blur-2xl">
          <DrawerHeader className="p-0 pb-3">
            <DrawerTitle className="text-base font-bold">Filtered Members</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto max-h-[70vh]">
            <AnalyticsMemberPanel
              members={analytics.filteredMembers}
              filters={filters}
              onClearFilter={clearFilter}
              onClearAll={clearAllFilters}
              onSearchChange={(q) => setFilter("search", q)}
              onClose={() => setMobileDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <AnalyticsSettingsDrawer
        open={settingsDrawerOpen}
        onOpenChange={setSettingsDrawerOpen}
        initialPreferences={user?.profile?.analytics_preferences ?? null}
        onSave={async (newPrefs) => {
          if (!user?.id) return;
          await updateAnalyticsPreferences(user.id, newPrefs as Record<string, any>);
          await refresh();
          toast.success("Analytics preferences saved.");
        }}
      />
    </div>
  );
}
