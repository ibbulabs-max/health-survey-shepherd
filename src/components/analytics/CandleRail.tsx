import React, { useRef } from "react";
import { Info, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CandleRailProps {
  title: string;
  unit?: string;
  infoTooltip?: string;
  onViewMembers?: () => void;
  children: React.ReactNode;
  emptyMessage?: string;
  hasData?: boolean;
  className?: string;
}

export function CandleRail({
  title,
  unit,
  infoTooltip,
  onViewMembers,
  children,
  emptyMessage = "No data recorded for current selection",
  hasData = true,
  className,
}: CandleRailProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -220, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 220, behavior: "smooth" });
    }
  };

  return (
    <div
      className={cn(
        "group relative bg-surface rounded-2xl border border-border/70 shadow-xs p-4 flex flex-col justify-between min-h-[220px] transition-all",
        className,
      )}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-display text-[13px] font-bold tracking-wider uppercase text-foreground truncate">
            {title}{" "}
            {unit && <span className="text-muted-foreground font-medium lowercase">({unit})</span>}
          </h3>
          {infoTooltip && (
            <span
              title={infoTooltip}
              className="text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help"
            >
              <Info className="size-3.5" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {hasData && (
            <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={scrollLeft}
                aria-label="Scroll left"
                className="size-6 rounded-lg bg-surface-muted border border-border/60 hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={scrollRight}
                aria-label="Scroll right"
                className="size-6 rounded-lg bg-surface-muted border border-border/60 hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}

          {onViewMembers && hasData && (
            <button
              type="button"
              onClick={onViewMembers}
              className="text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full transition-colors shrink-0"
            >
              View Members
            </button>
          )}
        </div>
      </div>

      {/* Content / Candle Rail */}
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/80 py-8 text-center border border-dashed border-border/50 rounded-xl bg-surface-muted/30">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex-1 w-full overflow-x-auto scrollbar-none snap-x snap-mandatory flex items-end gap-1.5 pb-1 pt-2 scroll-smooth"
        >
          {children}
        </div>
      )}
    </div>
  );
}
