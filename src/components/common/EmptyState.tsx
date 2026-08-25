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
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="card-surface flex items-center justify-center gap-3 px-6 py-14 text-sm text-muted-foreground">
      <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
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
