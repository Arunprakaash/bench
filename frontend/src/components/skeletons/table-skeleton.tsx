import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  /** Widths for cells after the checkbox. First entry is always flex-1. */
  columnWidths?: string[];
}

const DEFAULT_WIDTHS = ["w-20", "w-28", "w-16", "w-20", "w-24"];

export function TableSkeleton({ rows = 8, columnWidths = DEFAULT_WIDTHS }: TableSkeletonProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* action bar */}
      <div className="flex justify-end p-3 border-b bg-muted/5">
        <Skeleton className="h-9 w-36" />
      </div>
      {/* pagination bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      {/* header row */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/20">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className="h-3 flex-1" />
        {columnWidths.map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w} shrink-0`} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-[14px] border-b last:border-0"
          style={{ opacity: 1 - i * 0.07 }}
        >
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 flex-1" />
          {columnWidths.map((w, j) => (
            <Skeleton key={j} className={`h-4 ${w} shrink-0`} />
          ))}
        </div>
      ))}
    </div>
  );
}
