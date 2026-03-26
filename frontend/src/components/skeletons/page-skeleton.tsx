import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "./table-skeleton";

interface PageSkeletonProps {
  hasHeaderButton?: boolean;
  columnWidths?: string[];
  rows?: number;
}

export function PageSkeleton({ hasHeaderButton = false, columnWidths, rows }: PageSkeletonProps) {
  return (
    <div className="p-8 space-y-6">
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        {hasHeaderButton && <Skeleton className="h-9 w-32" />}
      </div>
      {/* filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-24" />
      </div>
      {/* table */}
      <TableSkeleton columnWidths={columnWidths} rows={rows} />
    </div>
  );
}
