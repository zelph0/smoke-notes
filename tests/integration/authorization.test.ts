import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSubtaskForOwner, createTaskForOwner, listTasksForOwner } from "@/features/tasks/data";
import { db } from "@/lib/db";
import type { Viewer } from "@/lib/viewer";

/**
 * Authorization, not just authentication: user B must not be able to read or modify
 * user A's tasks, whether through the data layer or the public server actions.
 */
const userA: Viewer = { id: `it-a-${randomUUID()}`, name: "A", email: "a@example.test", image: null };
const userB: Viewer = { id: `it-b-${randomUUID()}`, name: "B", email: "b@example.test", image: null };
let current: Viewer = userA;
vi.mock("@/lib/viewer", () => ({ requireViewer: async () => current, getViewer: async () => current }));

const { createSubtask, deleteSubtask, deleteTask, setSubtaskDone, setTaskDone, updateSubtask, updateTask } =
  await import("@/features/tasks/actions");
const { idle } = await import("@/lib/action-result");

let taskOfA: string;
let subtaskOfA: string;

beforeAll(async () => {
  taskOfA = (await createTaskForOwner(userA.id, { title: "A's private task", notes: "secret", dueDate: null })).id;
  const subtask = await createSubtaskForOwner(userA.id, { taskId: taskOfA, title: "A's private step" });
  if (typeof subtask === "string") throw new Error(subtask);
  subtaskOfA = subtask.id;
});

beforeEach(() => {
  current = userB;
});

afterAll(async () => {
  await db.task.deleteMany({ where: { ownerId: { in: [userA.id, userB.id] } } });
});

async function taskOfAInDb() {
  return db.task.findUniqueOrThrow({ where: { id: taskOfA } });
}

describe("user B cannot access user A's tasks", () => {
  it("can't read them", async () => {
    expect(await listTasksForOwner(userB.id, "all")).toEqual([]);
  });

  it("can't edit them", async () => {
    const form = new FormData();
    form.set("id", taskOfA);
    form.set("title", "pwned");
    const result = await updateTask(idle, form);
    expect(result).toEqual({ ok: false, error: "That task no longer exists." });
    expect((await taskOfAInDb()).title).toBe("A's private task");
  });

  it("can't complete them", async () => {
    // Exact error: A's task has an open subtask, so a bare `ok: false` would pass without the owner check.
    expect(await setTaskDone(taskOfA, true)).toEqual({ ok: false, error: "That task no longer exists." });
    expect((await taskOfAInDb()).status).toBe("TODO");
  });

  it("can't delete them", async () => {
    expect(await deleteTask(taskOfA)).toMatchObject({ ok: false });
    expect(await taskOfAInDb()).toBeTruthy();
  });

  it("can't add, rename, complete or delete their subtasks", async () => {
    const form = (values: Record<string, string>) => {
      const fd = new FormData();
      for (const [key, value] of Object.entries(values)) fd.set(key, value);
      return fd;
    };
    expect(await createSubtask(idle, form({ taskId: taskOfA, title: "planted" }))).toEqual({
      ok: false,
      error: "That task no longer exists.",
    });
    expect(await updateSubtask(idle, form({ id: subtaskOfA, title: "pwned" }))).toMatchObject({ ok: false });
    expect(await setSubtaskDone(subtaskOfA, true)).toMatchObject({ ok: false });
    expect(await deleteSubtask(subtaskOfA)).toMatchObject({ ok: false });

    const subtasks = await db.subtask.findMany({ where: { taskId: taskOfA } });
    expect(subtasks).toEqual([expect.objectContaining({ id: subtaskOfA, title: "A's private step", done: false })]);
  });

  it("while user A still can", async () => {
    current = userA;
    expect(await setTaskDone(taskOfA, true)).toEqual({ ok: false, error: "Finish every subtask first." });
    expect(await setSubtaskDone(subtaskOfA, true)).toMatchObject({ ok: true });
    expect(await setTaskDone(taskOfA, true)).toMatchObject({ ok: true });
    expect((await taskOfAInDb()).status).toBe("DONE");

    current = userB;
    expect(await setTaskDone(taskOfA, false)).toEqual({ ok: false, error: "That task no longer exists." });
    expect((await taskOfAInDb()).status).toBe("DONE");
  });
});
