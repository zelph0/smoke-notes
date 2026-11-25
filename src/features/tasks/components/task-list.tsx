"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { deleteTask, setTaskDone } from "../actions";
import type { TaskFilter } from "../schema";
import type { TaskDTO } from "../types";
import { TaskItem } from "./task-item";

type OptimisticChange = { type: "toggle"; id: string; done: boolean } | { type: "delete"; id: string };

export function applyChange(tasks: TaskDTO[], change: OptimisticChange, filter: TaskFilter): TaskDTO[] {
  if (change.type === "delete") return tasks.filter((task) => task.id !== change.id);
  return tasks
    .map((task) => (task.id === change.id ? { ...task, done: change.done } : task))
    .filter((task) => filter === "all" || (filter === "done" ? task.done : !task.done));
}

/**
 * Optimistic list: toggles and deletes show instantly, then the server action runs.
 * On failure the optimistic state is dropped automatically (the transition ends) and a toast explains.
 */
export function TaskList({ tasks, filter }: { tasks: TaskDTO[]; filter: TaskFilter }) {
  const [optimisticTasks, apply] = useOptimistic(tasks, (state, change: OptimisticChange) =>
    applyChange(state, change, filter),
  );
  const [, startTransition] = useTransition();

  function toggle(id: string, done: boolean) {
    startTransition(async () => {
      apply({ type: "toggle", id, done });
      const result = await setTaskDone(id, done);
      if (!result.ok) toast.error(result.error ?? "Couldn't update the task.");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      apply({ type: "delete", id });
      const result = await deleteTask(id);
      if (result.ok) toast.success(result.message ?? "Task deleted.");
      else toast.error(result.error ?? "Couldn't delete the task.");
    });
  }

  return (
    <ul aria-label="Tasks" className="flex flex-col divide-y divide-border">
      {optimisticTasks.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={toggle} onDelete={remove} />
      ))}
    </ul>
  );
}
