import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

function RecentRunsTableSkeleton() {
  const rows = 8;
  const cols = ["w-20", "w-16", "w-20", "w-28", "w-28"];
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-36" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/20">
          <Skeleton className="h-3 w-4 shrink-0" />
          <Skeleton className="h-3 flex-1" />
          {cols.map((w, i) => <Skeleton key={i} className={`h-3 ${w} shrink-0`} />)}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-[14px] border-b last:border-0"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            {cols.map((w, j) => <Skeleton key={j} className={`h-4 ${w} shrink-0`} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <RecentRunsTableSkeleton />
    </div>
  );
}
