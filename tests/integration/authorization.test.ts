import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTaskForOwner, listTasksForOwner } from "@/features/tasks/data";
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

const { deleteTask, setTaskDone, updateTask } = await import("@/features/tasks/actions");
const { idle } = await import("@/lib/action-result");

let taskOfA: string;

beforeAll(async () => {
  taskOfA = (await createTaskForOwner(userA.id, { title: "A's private task", notes: "secret", dueDate: null })).id;
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
    expect(await setTaskDone(taskOfA, true)).toMatchObject({ ok: false });
    expect((await taskOfAInDb()).status).toBe("TODO");
  });

  it("can't delete them", async () => {
    expect(await deleteTask(taskOfA)).toMatchObject({ ok: false });
    expect(await taskOfAInDb()).toBeTruthy();
  });

  it("while user A still can", async () => {
    current = userA;
    expect(await setTaskDone(taskOfA, true)).toMatchObject({ ok: true });
    expect((await taskOfAInDb()).status).toBe("DONE");
  });
});
