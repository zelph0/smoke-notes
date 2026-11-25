"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { deleteSubtask, deleteTask, setSubtaskDone, setTaskDone } from "../actions";
import type { TaskFilter } from "../schema";
import { openSubtaskCount, type TaskDTO } from "../types";
import { TaskItem } from "./task-item";

type OptimisticChange =
  | { type: "toggle"; id: string; done: boolean }
  | { type: "delete"; id: string }
  | { type: "subtask-toggle"; taskId: string; id: string; done: boolean }
  | { type: "subtask-delete"; taskId: string; id: string };

/** Mirrors the server's rules, so the optimistic state matches what the server will return. */
function applyToTask(task: TaskDTO, change: OptimisticChange): TaskDTO | null {
  switch (change.type) {
    case "delete":
      return null;
    case "toggle":
      // Completing is refused while subtasks are open.
      return { ...task, done: change.done ? openSubtaskCount(task) === 0 : false };
    case "subtask-toggle":
      return {
        ...task,
        // Reopening a subtask reopens its task.
        done: change.done ? task.done : false,
        subtasks: task.subtasks.map((s) => (s.id === change.id ? { ...s, done: change.done } : s)),
      };
    case "subtask-delete":
      return { ...task, subtasks: task.subtasks.filter((s) => s.id !== change.id) };
  }
}

export function applyChange(tasks: TaskDTO[], change: OptimisticChange, filter: TaskFilter): TaskDTO[] {
  const targetId = change.type === "toggle" || change.type === "delete" ? change.id : change.taskId;
  return tasks
    .flatMap((task) => {
      if (task.id !== targetId) return [task];
      const next = applyToTask(task, change);
      return next ? [next] : [];
    })
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

  function toggleSubtask(taskId: string, id: string, done: boolean) {
    startTransition(async () => {
      apply({ type: "subtask-toggle", taskId, id, done });
      const result = await setSubtaskDone(id, done);
      if (!result.ok) toast.error(result.error ?? "Couldn't update the subtask.");
    });
  }

  function removeSubtask(taskId: string, id: string) {
    startTransition(async () => {
      apply({ type: "subtask-delete", taskId, id });
      const result = await deleteSubtask(id);
      if (result.ok) toast.success(result.message ?? "Subtask deleted.");
      else toast.error(result.error ?? "Couldn't delete the subtask.");
    });
  }

  return (
    <ul aria-label="Tasks" className="flex flex-col divide-y divide-border">
      {optimisticTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={toggle}
          onDelete={remove}
          onToggleSubtask={(id, done) => toggleSubtask(task.id, id, done)}
          onDeleteSubtask={(id) => removeSubtask(task.id, id)}
        />
      ))}
    </ul>
  );
}
