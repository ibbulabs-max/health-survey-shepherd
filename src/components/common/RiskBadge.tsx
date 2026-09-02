import { riskDisplayLabel, type ClinicalRiskState, type RiskLevel } from "@/config/risk";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  low: "bg-risk-normal-soft text-risk-normal",
  moderate: "bg-risk-moderate-soft text-risk-moderate",
  high: "bg-risk-high-soft text-risk-high",
  missing: "bg-surface-muted text-muted-foreground",
  invalid: "bg-red-50 text-red-500",
};

export function RiskBadge({
  level,
  className,
  showDot = true,
}: {
  level: ClinicalRiskState | string | null | undefined;
  className?: string;
  showDot?: boolean;
}) {
  const normLevel = String(level || "missing").toLowerCase();
  const styleKey = styles[normLevel] ? normLevel : "missing";
  const display = riskDisplayLabel(level);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        styles[styleKey],
        className,
      )}
    >
      {showDot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {display}
    </span>
  );
}
