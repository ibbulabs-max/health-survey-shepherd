import React from "react";
import { cn } from "@/lib/utils";

export type CandleTone = "blue" | "purple" | "red" | "orange" | "green" | "teal" | "cyan";

export interface AnalyticsCandleProps {
  label: string;
  count: number;
  maxCount: number;
  totalCount?: number | undefined;
  tone?: CandleTone | undefined;
  isSelected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  tooltipExtra?: string | undefined;
  candleWidth?: string | undefined;
}

const TONE_STYLES: Record<CandleTone, { wick: string; body: string; ring: string }> = {
  blue: {
    wick: "bg-blue-500",
    body: "bg-gradient-to-b from-blue-400 to-blue-600 shadow-blue-500/20",
    ring: "ring-blue-500",
  },
  purple: {
    wick: "bg-purple-500",
    body: "bg-gradient-to-b from-purple-400 to-indigo-600 shadow-purple-500/20",
    ring: "ring-purple-500",
  },
  red: {
    wick: "bg-red-500",
    body: "bg-gradient-to-b from-rose-400 to-red-600 shadow-red-500/20",
    ring: "ring-red-500",
  },
  orange: {
    wick: "bg-amber-500",
    body: "bg-gradient-to-b from-amber-400 to-orange-500 shadow-orange-500/20",
    ring: "ring-amber-500",
  },
  green: {
    wick: "bg-emerald-500",
    body: "bg-gradient-to-b from-emerald-400 to-green-600 shadow-emerald-500/20",
    ring: "ring-emerald-500",
  },
  teal: {
    wick: "bg-teal-500",
    body: "bg-gradient-to-b from-teal-400 to-emerald-600 shadow-teal-500/20",
    ring: "ring-teal-500",
  },
  cyan: {
    wick: "bg-cyan-500",
    body: "bg-gradient-to-b from-cyan-400 to-blue-500 shadow-cyan-500/20",
    ring: "ring-cyan-500",
  },
};

export function AnalyticsCandle({
  label,
  count,
  maxCount,
  totalCount,
  tone = "blue",
  isSelected = false,
  onClick,
  tooltipExtra,
  candleWidth = "w-5 sm:w-6",
}: AnalyticsCandleProps) {
  // If count is 0, rule: HIDE THE ENTIRE CANDLE
  if (count <= 0) return null;

  const styles = TONE_STYLES[tone] ?? TONE_STYLES.blue;

  // Normalized height between 18px and 92px
  const heightRatio = maxCount > 0 ? count / maxCount : 0.1;
  const bodyHeightPx = Math.max(18, Math.round(heightRatio * 92));

  const pct = totalCount && totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : null;
  const tooltipText = `${label}: ${count.toLocaleString()} members${pct ? ` (${pct}%)` : ""}${tooltipExtra ? ` • ${tooltipExtra}` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltipText}
      className={cn(
        "group relative flex-1 flex flex-col items-center justify-end h-40 min-w-0 px-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer select-none",
        "hover:bg-surface-muted/70 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected && "bg-primary/10 ring-1 ring-primary/40 shadow-xs",
      )}
    >
      {/* Candle Graphic Stack */}
      <div className="flex-1 w-full flex flex-col items-center justify-end pb-1 relative">
        {/* Hover Tooltip Pill */}
        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shadow-md">
          {count.toLocaleString()}
          {pct && <span className="opacity-75 font-normal ml-1">({pct}%)</span>}
        </div>

        {/* Top Wick / Needle */}
        <div className={cn("w-[2px] h-2.5 rounded-t-full transition-colors", styles.wick)} />

        {/* Candle Main Body (Rounded Capsule) */}
        <div
          className={cn(
            candleWidth,
            "rounded-full transition-all duration-300 shadow-xs",
            styles.body,
            isSelected && `ring-2 ${styles.ring} ring-offset-1 scale-105`,
          )}
          style={{ height: `${bodyHeightPx}px` }}
        />
      </div>

      {/* Label and Count Info */}
      <div className="flex flex-col items-center justify-center w-full mt-1.5">
        <span
          className={cn(
            "text-[11px] font-medium leading-tight text-muted-foreground truncate max-w-[56px] text-center",
            isSelected && "text-primary font-bold",
          )}
        >
          {label}
        </span>
        <span className="text-[11px] font-bold leading-tight text-foreground tabular-nums text-center mt-0.5">
          {count.toLocaleString()}
        </span>
      </div>
    </button>
  );
}
