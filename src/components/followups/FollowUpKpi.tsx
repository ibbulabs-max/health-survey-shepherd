import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowUpKpiProps {
  title: string;
  count: number;
  subtitle: string;
  icon: LucideIcon;
  colorScheme: "blue" | "purple" | "red" | "emerald";
  isActive?: boolean;
  onClick?: () => void;
}

export function FollowUpKpi({
  title,
  count,
  subtitle,
  icon: Icon,
  colorScheme,
  isActive,
  onClick,
}: FollowUpKpiProps) {
  const schemeStyles = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  const titleStyles = {
    blue: "text-muted-foreground",
    purple: "text-muted-foreground",
    red: "text-red-600",
    emerald: "text-muted-foreground",
  };

  const valueStyles = {
    blue: "text-foreground",
    purple: "text-foreground",
    red: "text-red-600",
    emerald: "text-foreground",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "card-surface p-4 lg:p-5 rounded-2xl border bg-card shadow-card transition-all cursor-pointer group",
        isActive
          ? "border-primary/50 ring-1 ring-primary/20 shadow-float"
          : "border-border/60 hover:shadow-float",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "size-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform",
            schemeStyles[colorScheme],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              titleStyles[colorScheme],
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-2xl lg:text-3xl font-display font-bold mt-0.5",
              valueStyles[colorScheme],
            )}
          >
            {count}
          </p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
