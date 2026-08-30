export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>

      {/* Global Skeleton Cards that look good anywhere */}
      <div className="grid gap-3 opacity-50 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-surface p-4 rounded-2xl border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-border/40 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-border/40 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-border/40 rounded w-1/4 animate-pulse" />
              </div>
            </div>
            <div className="h-8 bg-border/30 rounded-xl w-full animate-pulse mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-foreground">Couldn't load this</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
