import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  countTasksForOwner,
  createTaskForOwner,
  deleteTaskForOwner,
  listTasksForOwner,
  setTaskDoneForOwner,
  updateTaskForOwner,
} from "@/features/tasks/data";
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
