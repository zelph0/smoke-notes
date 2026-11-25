import { Skeleton } from "@/components/ui/skeleton";
import { TaskListSkeleton } from "@/features/tasks/components/task-list-skeleton";

export default function TasksLoading() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <TaskListSkeleton />
    </main>
  );
}
