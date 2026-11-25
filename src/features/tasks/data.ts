import "server-only";
import type { Prisma, Task } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  type CreateSubtaskInput,
  type CreateTaskInput,
  SUBTASKS_PER_TASK_MAX,
  type TaskFilter,
  type UpdateSubtaskInput,
  type UpdateTaskInput,
} from "./schema";
import type { SubtaskDTO, TaskCounts, TaskDTO } from "./types";

/**
 * Data layer: every function takes the owner id explicitly and scopes EVERY query by it.
 * Callers are queries.ts / actions.ts, which resolve the owner from the session first.
 * Never call these with an id that came from the client.
 */

export const LIST_LIMIT = 200;

const subtaskSelect = { id: true, title: true, done: true } satisfies Prisma.SubtaskSelect;
const withSubtasks = {
  subtasks: { select: subtaskSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.TaskInclude;

export function toTaskDTO(task: Task & { subtasks?: SubtaskDTO[] }): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    done: task.status === "DONE",
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    createdAt: task.createdAt.toISOString(),
    subtasks: task.subtasks?.map(({ id, title, done }) => ({ id, title, done })) ?? [],
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
    include: withSubtasks,
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
  const task = await db.task.findFirst({ where: { id, ownerId }, include: withSubtasks });
  return task ? toTaskDTO(task) : null;
}

/*
 * The completion rule: a task can only be DONE when every subtask is done. Every write that could
 * break it (completing a task, reopening or adding a subtask) runs in a transaction that first locks
 * the task row, so concurrent writes to the same task apply one after another and each sees the
 * other's result.
 */
type Tx = Prisma.TransactionClient;

/** Locks the owner's task row for the rest of the transaction. False when it isn't theirs or doesn't exist. */
async function lockTask(tx: Tx, ownerId: string, taskId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Task" WHERE "id" = ${taskId} AND "ownerId" = ${ownerId} FOR UPDATE`;
  return rows.length > 0;
}

async function reopenIfDone(tx: Tx, taskId: string) {
  await tx.task.updateMany({ where: { id: taskId, status: "DONE" }, data: { status: "TODO" } });
}

export type SetTaskDoneResult = "ok" | "not_found" | "open_subtasks";

export async function setTaskDoneForOwner(ownerId: string, id: string, done: boolean): Promise<SetTaskDoneResult> {
  return db.$transaction(async (tx) => {
    if (!(await lockTask(tx, ownerId, id))) return "not_found";
    if (done && (await tx.subtask.count({ where: { taskId: id, done: false } })) > 0) return "open_subtasks";
    await tx.task.update({ where: { id }, data: { status: done ? "DONE" : "TODO" } });
    return "ok";
  });
}

export async function deleteTaskForOwner(ownerId: string, id: string): Promise<boolean> {
  const { count } = await db.task.deleteMany({ where: { id, ownerId } });
  return count > 0;
}

/* Subtasks: owner-scoped through their task (`task.ownerId`). */

export type CreateSubtaskResult = SubtaskDTO | "not_found" | "limit";

/** Adds a subtask and reopens the task if it was done (it now has an open subtask). */
export async function createSubtaskForOwner(ownerId: string, input: CreateSubtaskInput): Promise<CreateSubtaskResult> {
  return db.$transaction(async (tx) => {
    if (!(await lockTask(tx, ownerId, input.taskId))) return "not_found";
    if ((await tx.subtask.count({ where: { taskId: input.taskId } })) >= SUBTASKS_PER_TASK_MAX) return "limit";
    const subtask = await tx.subtask.create({ data: input, select: subtaskSelect });
    await reopenIfDone(tx, input.taskId);
    return subtask;
  });
}

/** Reopening a subtask reopens its task too. Returns false when the subtask isn't the owner's. */
export async function setSubtaskDoneForOwner(ownerId: string, id: string, done: boolean): Promise<boolean> {
  const found = await db.subtask.findFirst({ where: { id, task: { ownerId } }, select: { taskId: true } });
  if (!found) return false;
  return db.$transaction(async (tx) => {
    if (!(await lockTask(tx, ownerId, found.taskId))) return false;
    const { count } = await tx.subtask.updateMany({ where: { id, taskId: found.taskId }, data: { done } });
    if (count === 0) return false;
    if (!done) await reopenIfDone(tx, found.taskId);
    return true;
  });
}

export async function updateSubtaskForOwner(ownerId: string, input: UpdateSubtaskInput): Promise<SubtaskDTO | null> {
  const { id, title } = input;
  const { count } = await db.subtask.updateMany({ where: { id, task: { ownerId } }, data: { title } });
  if (count === 0) return null;
  return db.subtask.findFirst({ where: { id, task: { ownerId } }, select: subtaskSelect });
}

/** Deleting never breaks the completion rule, so no lock is needed. */
export async function deleteSubtaskForOwner(ownerId: string, id: string): Promise<boolean> {
  const { count } = await db.subtask.deleteMany({ where: { id, task: { ownerId } } });
  return count > 0;
}
