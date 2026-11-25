import { Skeleton } from "@/components/ui/skeleton";

export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading tasks" className="flex flex-col gap-4">
      <Skeleton className="h-control w-full" />
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={index} className="flex items-start gap-3 py-3">
            <Skeleton className="size-4 rounded-[4px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
