import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ArrowRight, Home } from "lucide-react";
import { useState } from "react";

import { useDataset } from "@/hooks/useDataset";
import { RiskBadge } from "@/components/common/RiskBadge";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
import type { HouseView } from "@/lib/domain";

// Example: /drilldown?metric=age&value=35
export const Route = createFileRoute("/_authenticated/drilldown")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      metric: (search["metric"] as string) || "",
      value: (search["value"] as string) || "",
    };
  },
  component: DrilldownPage,
});

function DrilldownPage() {
  const { metric, value } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useDataset();
  const [selectedHouse, setSelectedHouse] = useState<HouseView | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const members = (data?.members ?? []).filter((m) => {
    if (metric === "age") return m.age?.toString() === value;
    if (metric === "bp") return `${m.systolic}/${m.diastolic}` === value;
    if (metric === "sugar") return m.bloodSugar?.toString() === value;
    if (metric === "condition") return m.conditions.includes(value);
    if (metric === "noCondition") return m.conditions.length === 0;
    if (metric === "risk") return m.risk === value;
    if (metric === "tobacco") {
      const tob = String(m.extraFields["tobacco"] || m.assessment?.["tobacco"] || "").trim();
      return tob === value;
    }
    if (metric === "bmi") {
      const weight = m.extraFields["weight_kg"] ? Number(m.extraFields["weight_kg"]) : null;
      const height = m.extraFields["height_cm"] ? Number(m.extraFields["height_cm"]) : null;
      if (!weight || !height) return false;
      const bmi = weight / Math.pow(height / 100, 2);
      if (value === "Underweight") return bmi < 18.5;
      if (value === "Normal") return bmi >= 18.5 && bmi < 25;
      if (value === "Overweight") return bmi >= 25 && bmi < 30;
      if (value === "Obese") return bmi >= 30;
    }
    
    return false;
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border/40 z-10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/analytics" })}
          className="p-1.5 rounded-full hover:bg-surface-muted transition-colors text-muted-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <h1 className="font-display font-bold text-base capitalize">
            {metric} Drilldown: {value || "All"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {members.length} members matching criteria
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No members found matching this criteria.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {members.map((m) => {
              const house = m.houseUuid ? data?.byHouseUuid.get(m.houseUuid) : null;
              return (
                <div
                  key={m.id}
                  className="card-surface p-4 rounded-xl border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{m.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({m.memberId || "No MID"})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Age {m.age ?? "?"} • {m.gender || "Unknown"}
                      {m.houseId && (
                        <span>
                          {" "}• House:{" "}
                          <button
                            type="button"
                            onClick={() => {
                              if (house) setSelectedHouse(house);
                            }}
                            className="text-primary font-bold hover:underline"
                          >
                            {m.houseId}
                          </button>
                        </span>
                      )}
                    </p>
                    <div className="text-xs text-muted-foreground flex gap-3 pt-1">
                      <span>BP: <strong className="text-foreground">{m.systolic && m.diastolic ? `${m.systolic}/${m.diastolic}` : "—"}</strong></span>
                      <span>Sugar: <strong className="text-foreground">{m.bloodSugar ?? "—"}</strong></span>
                      {m.conditions.length > 0 && (
                        <span>Conditions: <strong className="text-foreground">{m.conditions.join(", ")}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 items-center mt-2 sm:mt-0 shrink-0">
                    <RiskBadge level={m.risk} />
                    
                    <div className="flex gap-1.5">
                      <Link
                        to="/assessments/$memberId"
                        params={{ memberId: m.id }}
                        className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-lg transition-colors border border-primary/10"
                      >
                        Assessment
                      </Link>
                      {house && (
                        <button
                          type="button"
                          onClick={() => setSelectedHouse(house)}
                          className="text-primary hover:bg-primary-soft p-2 rounded-lg transition-colors flex items-center justify-center bg-surface border border-border/50 shadow-sm"
                          title="View House"
                        >
                          <Home className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Global Unified House Detail Bottom Sheet */}
      <HouseDetailSheet
        house={selectedHouse}
        open={Boolean(selectedHouse)}
        onOpenChange={(open) => !open && setSelectedHouse(null)}
      />
    </div>
  );
}
