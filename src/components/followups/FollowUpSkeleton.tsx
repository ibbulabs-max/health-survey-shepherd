import { Skeleton } from "@/components/ui/skeleton";

export function FollowUpSkeleton() {
  return (
    <div className="card-surface p-4 lg:p-5 rounded-2xl border border-border/60 bg-card shadow-card relative overflow-hidden">
      <div className="flex flex-col gap-4">
        {/* Top Row: Avatar + Info + Dates */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Skeleton className="size-10 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
              <div className="flex gap-1 pt-1">
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5 shrink-0 text-right">
            <Skeleton className="h-2 w-16 ml-auto" />
            <Skeleton className="h-3 w-20 ml-auto" />
            <Skeleton className="h-2 w-16 ml-auto mt-2" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
        </div>

        {/* Middle Row */}
        <div className="pt-2 border-t border-border/40 flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>

        {/* Bottom Row */}
        <div className="pt-3 mt-1 border-t border-border/40 flex items-center justify-end gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
