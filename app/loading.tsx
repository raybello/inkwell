export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
        <span className="size-1.5 animate-pulse rounded-full bg-accent" />
        Loading
      </div>
    </div>
  );
}
