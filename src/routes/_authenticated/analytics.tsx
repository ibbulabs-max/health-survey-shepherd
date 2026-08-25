import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { riskConfig, riskLabels, type RiskLevel } from "@/config/risk";
import { useDataset } from "@/hooks/useDataset";
import type { MemberView } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Age bands, blood pressure and blood sugar distribution, risk mix and condition prevalence across all screened members.",
      },
      { property: "og:title", content: "Analytics — Management App" },
      {
        property: "og:description",
        content: "Age, blood pressure, blood sugar and risk analytics for screened members.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const AGE_BANDS: [string, number, number][] = [
  ["0-17", 0, 17],
  ["18-29", 18, 29],
  ["30-44", 30, 44],
  ["45-59", 45, 59],
  ["60-74", 60, 74],
  ["75+", 75, 200],
];

function AnalyticsPage() {
  const { data, stats, isLoading, error, refetch } = useDataset();

  const analytics = useMemo(() => {
    const members = data?.members ?? [];
    const ages = AGE_BANDS.map(([label, min, max]) => ({
      label,
      count: members.filter((m) => m.age != null && m.age >= min && m.age <= max).length,
    }));

    const bp = [
      {
        label: `Normal (<${riskConfig.bp.moderate.systolic})`,
        count: members.filter(
          (m) => m.systolic != null && m.systolic < riskConfig.bp.moderate.systolic,
        ).length,
        tone: "low" as const,
      },
      {
        label: `Raised (${riskConfig.bp.moderate.systolic}-${riskConfig.bp.high.systolic - 1})`,
        count: members.filter(
          (m) =>
            m.systolic != null &&
            m.systolic >= riskConfig.bp.moderate.systolic &&
            m.systolic < riskConfig.bp.high.systolic,
        ).length,
        tone: "moderate" as const,
      },
      {
        label: `High (${riskConfig.bp.high.systolic}+)`,
        count: members.filter((m) => m.systolic != null && m.systolic >= riskConfig.bp.high.systolic)
          .length,
        tone: "high" as const,
      },
    ];

    const sugar = [
      {
        label: `Normal (<${riskConfig.sugar.moderate})`,
        count: members.filter((m) => m.bloodSugar != null && m.bloodSugar < riskConfig.sugar.moderate)
          .length,
        tone: "low" as const,
      },
      {
        label: `Raised (${riskConfig.sugar.moderate}-${riskConfig.sugar.high - 1})`,
        count: members.filter(
          (m) =>
            m.bloodSugar != null &&
            m.bloodSugar >= riskConfig.sugar.moderate &&
            m.bloodSugar < riskConfig.sugar.high,
        ).length,
        tone: "moderate" as const,
      },
      {
        label: `High (${riskConfig.sugar.high}+)`,
        count: members.filter((m) => m.bloodSugar != null && m.bloodSugar >= riskConfig.sugar.high)
          .length,
        tone: "high" as const,
      },
    ];

    const conditionCounts = new Map<string, number>();
    members.forEach((m) =>
      m.conditions.forEach((c) => conditionCounts.set(c, (conditionCounts.get(c) ?? 0) + 1)),
    );

    const genders = new Map<string, number>();
    members.forEach((m) => {
      const key = (m.gender ?? "Unknown").toString();
      genders.set(key, (genders.get(key) ?? 0) + 1);
    });

    return {
      ages,
      bp,
      sugar,
      conditions: [...conditionCounts.entries()].sort((a, b) => b[1] - a[1]),
      genders: [...genders.entries()].sort((a, b) => b[1] - a[1]),
      averages: {
        systolic: average(members, (m) => m.systolic),
        diastolic: average(members, (m) => m.diastolic),
        sugar: average(members, (m) => m.bloodSugar),
        age: average(members, (m) => m.age),
      },
    };
  }, [data]);

  if (isLoading) return <LoadingState label="Crunching analytics…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle={`${stats.screened} of ${stats.members} members screened`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Average age" value={analytics.averages.age ?? "—"} hint="years" />
        <StatCard
          label="Average BP"
          value={
            analytics.averages.systolic && analytics.averages.diastolic
              ? `${analytics.averages.systolic}/${analytics.averages.diastolic}`
              : "—"
          }
          hint="mmHg"
        />
        <StatCard label="Average sugar" value={analytics.averages.sugar ?? "—"} hint="mg/dL" />
        <StatCard label="High risk" value={stats.risk.high} tone="high" hint="members" />
      </div>

      <BarBlock title="Risk distribution" rows={(["high", "moderate", "low"] as RiskLevel[]).map((r) => ({ label: riskLabels[r], count: stats.risk[r], tone: r }))} />
      <BarBlock title="Age bands" rows={analytics.ages} />
      <BarBlock title="Blood pressure" rows={analytics.bp} />
      <BarBlock title="Blood sugar" rows={analytics.sugar} />
      <BarBlock title="Gender" rows={analytics.genders.map(([label, count]) => ({ label, count }))} />
      {analytics.conditions.length ? (
        <BarBlock
          title="Condition prevalence"
          rows={analytics.conditions.map(([label, count]) => ({ label, count }))}
        />
      ) : null}
    </div>
  );
}

function average(members: MemberView[], pick: (m: MemberView) => number | null) {
  const values = members.map(pick).filter((v): v is number => v != null);
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function BarBlock({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; tone?: "low" | "moderate" | "high" }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const tones: Record<string, string> = {
    low: "bg-risk-low",
    moderate: "bg-risk-moderate",
    high: "bg-risk-high",
    default: "bg-primary",
  };
  return (
    <section className="card-surface p-5">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold tabular-nums">{row.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${tones[row.tone ?? "default"]}`}
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
