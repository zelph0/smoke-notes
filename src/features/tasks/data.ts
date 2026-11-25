import "server-only";
import type { Task } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { CreateTaskInput, TaskFilter, UpdateTaskInput } from "./schema";
import type { TaskCounts, TaskDTO } from "./types";

/**
 * Data layer: every function takes the owner id explicitly and scopes EVERY query by it.
 * Callers are queries.ts / actions.ts, which resolve the owner from the session first.
 * Never call these with an id that came from the client.
 */

export const LIST_LIMIT = 200;

export function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    done: task.status === "DONE",
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    createdAt: task.createdAt.toISOString(),
  };
}

export async function listTasksForOwner(ownerId: string, filter: TaskFilter): Promise<TaskDTO[]> {
  const tasks = await db.task.findMany({
    where: {
      ownerId,
      ...(filter === "active" ? { status: "TODO" } : filter === "done" ? { status: "DONE" } : {}),
    },
    // Open tasks first (enum order: TODO < DONE), newest first within each group.
    // Matches the (ownerId, status, createdAt DESC) index.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: LIST_LIMIT,
  });
  return tasks.map(toTaskDTO);
}

export async function countTasksForOwner(ownerId: string): Promise<TaskCounts> {
  const groups = await db.task.groupBy({ by: ["status"], where: { ownerId }, _count: { _all: true } });
  const active = groups.find((g) => g.status === "TODO")?._count._all ?? 0;
  const done = groups.find((g) => g.status === "DONE")?._count._all ?? 0;
  return { all: active + done, active, done };
}

export async function createTaskForOwner(ownerId: string, input: CreateTaskInput): Promise<TaskDTO> {
  const task = await db.task.create({ data: { ownerId, ...input } });
  return toTaskDTO(task);
}

/** Returns null when the task doesn't exist or belongs to someone else (same answer, on purpose). */
export async function updateTaskForOwner(ownerId: string, input: UpdateTaskInput): Promise<TaskDTO | null> {
  const { id, ...data } = input;
  const { count } = await db.task.updateMany({ where: { id, ownerId }, data });
  if (count === 0) return null;
  const task = await db.task.findFirst({ where: { id, ownerId } });
  return task ? toTaskDTO(task) : null;
}

export async function setTaskDoneForOwner(ownerId: string, id: string, done: boolean): Promise<boolean> {
  const { count } = await db.task.updateMany({ where: { id, ownerId }, data: { status: done ? "DONE" : "TODO" } });
  return count > 0;
}

export async function deleteTaskForOwner(ownerId: string, id: string): Promise<boolean> {
  const { count } = await db.task.deleteMany({ where: { id, ownerId } });
  return count > 0;
}
