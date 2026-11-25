import { CheckCircle2Icon, ListTodoIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { TaskFilter } from "../schema";

/** Two empty states: no tasks at all, and none matching the current filter. */
export function TasksEmptyState({ filter, total }: { filter: TaskFilter; total: number }) {
  if (total === 0) {
    return (
      <div role="status" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <ListTodoIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <h2 className="text-lg">No tasks yet</h2>
        <p className="max-w-xs text-muted-foreground text-sm">Add your first task above. It will show up here.</p>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <CheckCircle2Icon aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="text-lg">{filter === "active" ? "All done" : "Nothing finished yet"}</h2>
      <p className="max-w-xs text-muted-foreground text-sm">
        {filter === "active" ? "Every task is complete." : "Tasks you complete will appear here."}
      </p>
      <Link href="/tasks" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Show all tasks
      </Link>
    </div>
  );
}
