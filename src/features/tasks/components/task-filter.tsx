import Link from "next/link";
import { cn } from "@/lib/utils";
import { TASK_FILTERS, type TaskFilter } from "../schema";
import type { TaskCounts } from "../types";

const LABELS: Record<TaskFilter, string> = { all: "All", active: "Active", done: "Done" };

/** Filter state lives in the URL (?filter=), so it is shareable and survives reloads. */
export function TaskFilterNav({ current, counts }: { current: TaskFilter; counts: TaskCounts }) {
  return (
    <nav aria-label="Filter tasks" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
      {TASK_FILTERS.map((filter) => {
        const active = filter === current;
        return (
          <Link
            key={filter}
            href={filter === "all" ? "/tasks" : `/tasks?filter=${filter}`}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-control-sm flex-1 items-center justify-center gap-1.5 rounded-md px-3 font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              active && "bg-background text-foreground shadow-surface",
            )}
          >
            {LABELS[filter]}
            <span className="text-xs tabular-nums opacity-70">{counts[filter]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
