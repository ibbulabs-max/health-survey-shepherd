import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  to,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "normal" | "moderate" | "high";
  to?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    normal: "text-risk-normal",
    moderate: "text-risk-moderate",
    high: "text-risk-high",
  };
  const body = (
    <div className="card-surface flex h-full flex-col justify-between gap-3 p-4 transition-shadow hover:shadow-float">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </div>
      <div>
        <p className={cn("font-display text-2xl font-semibold tabular-nums", tones[tone])}>
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
