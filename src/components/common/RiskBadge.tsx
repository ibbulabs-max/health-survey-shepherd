import { riskLabels, type RiskLevel } from "@/config/risk";
import { cn } from "@/lib/utils";

const styles: Record<RiskLevel, string> = {
  low: "bg-risk-low-soft text-risk-low",
  moderate: "bg-risk-moderate-soft text-risk-moderate",
  high: "bg-risk-high-soft text-risk-high",
};

export function RiskBadge({
  level,
  className,
  showDot = true,
}: {
  level: RiskLevel;
  className?: string;
  showDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[level],
        className,
      )}
    >
      {showDot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {riskLabels[level]}
    </span>
  );
}
