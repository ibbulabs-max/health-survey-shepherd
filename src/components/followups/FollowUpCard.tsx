import { Link } from "@tanstack/react-router";
import { Eye, CalendarClock, Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnrichedFollowUpItem } from "./types";

interface FollowUpCardProps {
  item: EnrichedFollowUpItem;
  dailyTarget?: number;
  onReschedule: (item: EnrichedFollowUpItem) => void;
  onComplete: (item: EnrichedFollowUpItem) => void;
  /** Optional: show assigned CHW distance (for CHW view) */
  showDistance?: boolean;
}

export function FollowUpCard({
  item,
  dailyTarget = 10,
  onReschedule,
  onComplete,
  showDistance,
}: FollowUpCardProps) {
  const initials = (item.member?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isEligible = item.summary.isEligible;

  const statusBadgeStyle =
    item.status === "overdue"
      ? "bg-red-50 text-red-600 border border-red-100"
      : item.status === "today"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : item.status === "completed"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-blue-50 text-blue-700 border border-blue-100";

  const statusLabel =
    item.status === "overdue"
      ? "OVERDUE"
      : item.status === "today"
        ? "TODAY"
        : item.status === "completed"
          ? "COMPLETED"
          : item.status === "upcoming"
            ? "UPCOMING"
            : item.status.toUpperCase();

  const avatarBg =
    item.risk === "high"
      ? "bg-red-100 text-red-700"
      : item.risk === "moderate"
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";

  const riskBarColor =
    item.risk === "high"
      ? "bg-red-500"
      : item.risk === "moderate"
        ? "bg-orange-500"
        : "bg-blue-500";

  return (
    <div className="card-surface p-4 lg:p-5 rounded-2xl border border-border/60 bg-card shadow-card hover:shadow-float transition-all relative overflow-hidden group">
      {/* Left risk accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", riskBarColor)} />

      <div className="flex flex-col gap-3">
        {/* Top Row: Avatar + Member Info + Dates */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "size-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                avatarBg,
              )}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-foreground text-sm lg:text-base truncate">
                {item.member?.name ?? "Unnamed Member"}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                House ID: {item.house?.house?.house_id || item.member?.houseId || "—"}
              </p>

              {/* Condition tags */}
              {item.member?.conditions && item.member.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.member.conditions.slice(0, 2).map((c, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100"
                    >
                      {c}
                    </span>
                  ))}
                  {item.member.conditions.length > 2 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      +{item.member.conditions.length - 2}
                    </span>
                  )}
                </div>
              )}

              {/* CHW distance */}
              {showDistance && (
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="size-3" />
                  <span>—</span>
                </p>
              )}
            </div>
          </div>

          {/* Date block */}
          <div className="text-right shrink-0">
            {item.status === "completed" ? (
              <>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                  Survey Date
                </p>
                <p className="text-xs font-semibold text-foreground">{item.displaySurveyDate}</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mt-1.5">
                  Completed Date
                </p>
                <p className="text-xs font-bold text-foreground">{item.displayDueDate}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                  Survey Date
                </p>
                <p className="text-xs font-semibold text-foreground">{item.displaySurveyDate}</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mt-1.5">
                  Follow-up Date
                </p>
                <p className="text-xs font-bold text-foreground">{item.displayDueDate}</p>
              </>
            )}
            <span
              className={cn(
                "inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-md mt-1",
                statusBadgeStyle,
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Vitals row */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mr-1">
              Vitals:
            </span>
            {item.vitalsToCheck.map((v) => (
              <span
                key={v}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100"
              >
                {v}
              </span>
            ))}
          </div>

          {!isEligible && (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Age {item.member?.age ?? "?"} (Not eligible)
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="pt-2 mt-0.5 border-t border-border/40 flex items-center gap-2 justify-end">
          {/* Eye = View Member */}
          <Link to="/members/$memberId" params={{ memberId: item.member?.id || "" }}>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl size-9 text-blue-700 bg-blue-50/50 hover:bg-blue-50 border-blue-200 shadow-sm"
              title="View Member"
              aria-label="View member"
            >
              <Eye className="size-4" />
            </Button>
          </Link>

          {/* Reschedule */}
          {item.status !== "completed" && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onReschedule(item)}
              className="rounded-xl size-9 text-amber-700 bg-amber-50/50 hover:bg-amber-50 border-amber-200 shadow-sm"
              title="Reschedule"
              aria-label="Reschedule follow-up"
            >
              <CalendarClock className="size-4" />
            </Button>
          )}

          {/* Complete */}
          {item.status !== "completed" && (
            <Button
              size="sm"
              onClick={() => onComplete(item)}
              className="flex-1 rounded-xl text-xs font-semibold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              aria-label="Complete follow-up"
            >
              <Check className="size-4 mr-1.5" />
              <span>Complete</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
