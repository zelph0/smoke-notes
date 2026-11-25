import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SetTaskDoneResult } from "@/features/tasks/data";
import {
  countTasksForOwner,
  createSubtaskForOwner,
  createTaskForOwner,
  deleteSubtaskForOwner,
  deleteTaskForOwner,
  listTasksForOwner,
  setSubtaskDoneForOwner,
  setTaskDoneForOwner,
  updateSubtaskForOwner,
  updateTaskForOwner,
} from "@/features/tasks/data";
import { SUBTASKS_PER_TASK_MAX } from "@/features/tasks/schema";
import type { SubtaskDTO } from "@/features/tasks/types";
import { db } from "@/lib/db";

// Each run uses fresh owner ids and cleans up only its own rows, so runs never collide.
const owner = `it-${randomUUID()}`;

afterAll(async () => {
  await db.task.deleteMany({ where: { ownerId: owner } });
});

describe("tasks data layer (real Postgres on the test branch)", () => {
  it("creates, lists (open first, newest first), filters and counts", async () => {
    const first = await createTaskForOwner(owner, { title: "First", notes: null, dueDate: null });
    const second = await createTaskForOwner(owner, {
      title: "Second",
      notes: "with notes",
      dueDate: new Date("2027-01-15T00:00:00Z"),
    });
    expect(second.dueDate).toBe("2027-01-15");

    await setTaskDoneForOwner(owner, first.id, true);

    const all = await listTasksForOwner(owner, "all");
    expect(all.map((t) => t.title)).toEqual(["Second", "First"]);
    expect((await listTasksForOwner(owner, "active")).map((t) => t.id)).toEqual([second.id]);
    expect((await listTasksForOwner(owner, "done")).map((t) => t.id)).toEqual([first.id]);
    expect(await countTasksForOwner(owner)).toEqual({ all: 2, active: 1, done: 1 });
  });

  it("updates and deletes", async () => {
    const task = await createTaskForOwner(owner, { title: "Draft", notes: null, dueDate: null });
    const updated = await updateTaskForOwner(owner, { id: task.id, title: "Final", notes: "done", dueDate: null });
    expect(updated).toMatchObject({ id: task.id, title: "Final", notes: "done" });
    expect(await deleteTaskForOwner(owner, task.id)).toBe(true);
    expect(await deleteTaskForOwner(owner, task.id)).toBe(false);
  });
});

describe("subtasks and the completion rule", () => {
  async function newTask(title: string) {
    return createTaskForOwner(owner, { title, notes: null, dueDate: null });
  }
  async function addSubtask(taskId: string, title: string) {
    const result = await createSubtaskForOwner(owner, { taskId, title });
    if (typeof result === "string") throw new Error(`expected a subtask, got ${result}`);
    return result;
  }
  async function find(taskId: string) {
    return (await listTasksForOwner(owner, "all")).find((t) => t.id === taskId);
  }

  it("lists subtasks oldest first with the task", async () => {
    const task = await newTask("Launch");
    await addSubtask(task.id, "Outline");
    await addSubtask(task.id, "Draft");
    expect((await find(task.id))?.subtasks.map((s) => s.title)).toEqual(["Outline", "Draft"]);
  });

  it("blocks completing a task until every subtask is done", async () => {
    const task = await newTask("Blocked");
    const a = await addSubtask(task.id, "A");
    const b = await addSubtask(task.id, "B");

    expect(await setTaskDoneForOwner(owner, task.id, true)).toBe("open_subtasks");
    expect((await find(task.id))?.done).toBe(false);

    await setSubtaskDoneForOwner(owner, a.id, true);
    expect(await setTaskDoneForOwner(owner, task.id, true)).toBe("open_subtasks");

    await setSubtaskDoneForOwner(owner, b.id, true);
    expect(await setTaskDoneForOwner(owner, task.id, true)).toBe("ok");
    expect((await find(task.id))?.done).toBe(true);
  });

  it("reopens a done task when a subtask is reopened or added", async () => {
    const task = await newTask("Reopen");
    const a = await addSubtask(task.id, "A");
    await setSubtaskDoneForOwner(owner, a.id, true);
    await setTaskDoneForOwner(owner, task.id, true);

    await setSubtaskDoneForOwner(owner, a.id, false);
    expect((await find(task.id))?.done).toBe(false);

    await setSubtaskDoneForOwner(owner, a.id, true);
    await setTaskDoneForOwner(owner, task.id, true);
    await addSubtask(task.id, "B");
    expect((await find(task.id))?.done).toBe(false);
  });

  it("completing waits for a concurrent writer holding the task lock, then sees its write", async () => {
    const task = await newTask("Race");
    const a = await addSubtask(task.id, "A");
    await setSubtaskDoneForOwner(owner, a.id, true);

    let completion: Promise<SetTaskDoneResult> | undefined;
    await db.$transaction(async (tx) => {
      // Play the part of a concurrent "reopen subtask": lock the task, reopen the subtask, don't commit yet.
      await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${task.id} FOR UPDATE`;
      await tx.subtask.update({ where: { id: a.id }, data: { done: false } });
      completion = setTaskDoneForOwner(owner, task.id, true);
      const early = await Promise.race([
        completion.then(() => "finished"),
        new Promise((resolve) => setTimeout(() => resolve("waiting"), 750)),
      ]);
      expect(early).toBe("waiting"); // blocked on the row lock
    });

    // Without the lock it would have counted the old (done) subtask and marked the task DONE.
    expect(await completion).toBe("open_subtasks");
    expect((await find(task.id))?.done).toBe(false);
  });

  it("renames, deletes, caps the count and cascades on task delete", async () => {
    const task = await newTask("Housekeeping");
    const a = await addSubtask(task.id, "Old name");
    expect(await updateSubtaskForOwner(owner, { id: a.id, title: "New name" })).toEqual<SubtaskDTO>({
      id: a.id,
      title: "New name",
      done: false,
    });
    expect(await deleteSubtaskForOwner(owner, a.id)).toBe(true);
    expect(await deleteSubtaskForOwner(owner, a.id)).toBe(false);

    await db.subtask.createMany({
      data: Array.from({ length: SUBTASKS_PER_TASK_MAX }, (_, i) => ({ taskId: task.id, title: `S${i}` })),
    });
    expect(await createSubtaskForOwner(owner, { taskId: task.id, title: "One too many" })).toBe("limit");

    await deleteTaskForOwner(owner, task.id);
    expect(await db.subtask.count({ where: { taskId: task.id } })).toBe(0);
  });
});
