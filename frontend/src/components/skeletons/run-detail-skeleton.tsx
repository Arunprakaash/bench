import { Skeleton } from "@/components/ui/skeleton";

export function RunDetailSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-2.5 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      </div>

      {/* split pane */}
      <div className="flex flex-1 min-h-0">
        {/* left turn list */}
        <div className="w-80 shrink-0 border-r overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* right detail */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
