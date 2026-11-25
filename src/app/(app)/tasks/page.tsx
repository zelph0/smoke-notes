import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TasksEmptyState } from "@/features/tasks/components/empty-state";
import { TaskFilterNav } from "@/features/tasks/components/task-filter";
import { TaskForm } from "@/features/tasks/components/task-form";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskListSkeleton } from "@/features/tasks/components/task-list-skeleton";
import { countTasks, listTasks } from "@/features/tasks/queries";
import { taskFilterSchema } from "@/features/tasks/schema";

export const metadata: Metadata = { title: "Tasks" };

/**
 * Page pattern: the static shell (heading, create form) renders instantly; everything that
 * reads the session or the URL streams in behind <Suspense>. loading.tsx covers navigation,
 * error.tsx covers failures, TasksEmptyState covers "no data".
 */
export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl">Tasks</h1>
        <p className="text-muted-foreground text-sm">Capture what needs doing, then check it off.</p>
      </header>

      <Card>
        <CardContent>
          <TaskForm mode="create" />
        </CardContent>
      </Card>

      <section aria-label="Your tasks" className="flex flex-col gap-4">
        <Suspense fallback={<TaskListSkeleton />}>
          <TaskBoard searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

async function TaskBoard({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const filter = taskFilterSchema.parse((await searchParams).filter);
  const [tasks, counts] = await Promise.all([listTasks(filter), countTasks()]);

  return (
    <>
      <TaskFilterNav current={filter} counts={counts} />
      {tasks.length === 0 ? (
        <TasksEmptyState filter={filter} total={counts.all} />
      ) : (
        <TaskList key={filter} tasks={tasks} filter={filter} />
      )}
    </>
  );
}
