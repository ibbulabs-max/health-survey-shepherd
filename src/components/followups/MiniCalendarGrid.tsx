import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { toDateKeySafe } from "@/lib/followUpEngine";

interface MiniCalendarGridProps {
  year: number;
  month: number;
  todayKey: string;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  countsMap: Map<string, { total: number; high: number; moderate: number; low: number }>;
}

export function MiniCalendarGrid({
  year,
  month,
  todayKey,
  selectedDate,
  onSelectDate,
  countsMap,
}: MiniCalendarGridProps) {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarDays = useMemo(() => {
    const days: { date: Date; dateKey: string; isCurrentMonth: boolean }[] = [];
    const firstDayIndex = new Date(year, month, 1).getDay();

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dateKey: toDateKeySafe(d), isCurrentMonth: false });
    }

    // Current month days
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, dateKey: toDateKeySafe(d), isCurrentMonth: true });
    }

    // Next month padding to fill grid
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1]!.date;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      days.push({ date: next, dateKey: toDateKeySafe(next), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  return (
    <div className="space-y-2 select-none">
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground">
        {daysOfWeek.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map(({ date, dateKey, isCurrentMonth }) => {
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const countInfo = countsMap.get(dateKey);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                "h-8 rounded-lg flex flex-col items-center justify-center relative transition-all text-xs font-semibold",
                !isCurrentMonth && "text-muted-foreground/30",
                isCurrentMonth && "text-foreground hover:bg-surface-muted",
                isToday && "border border-primary font-bold",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span>{date.getDate()}</span>
              {countInfo && countInfo.total > 0 && (
                <div className="flex gap-0.5 absolute bottom-1">
                  {countInfo.high > 0 && <span className="size-1 rounded-full bg-red-500" />}
                  {countInfo.moderate > 0 && <span className="size-1 rounded-full bg-orange-500" />}
                  {countInfo.low > 0 && <span className="size-1 rounded-full bg-blue-500" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
