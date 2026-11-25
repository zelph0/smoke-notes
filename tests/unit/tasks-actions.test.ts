import { beforeEach, describe, expect, it, vi } from "vitest";

// Server actions are tested with their boundaries mocked: session, data layer, cache, Sentry.
const viewer = { id: "user-a", name: "A", email: "a@example.test", image: null };
vi.mock("@/lib/viewer", () => ({ requireViewer: vi.fn(async () => viewer) }));
vi.mock("@/features/tasks/data", () => ({
  createTaskForOwner: vi.fn(),
  updateTaskForOwner: vi.fn(),
  setTaskDoneForOwner: vi.fn(),
  deleteTaskForOwner: vi.fn(),
  createSubtaskForOwner: vi.fn(),
  updateSubtaskForOwner: vi.fn(),
  setSubtaskDoneForOwner: vi.fn(),
  deleteSubtaskForOwner: vi.fn(),
}));
vi.mock("next/cache", () => ({ updateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/observability", () => ({ reportError: vi.fn(() => "evt_1") }));

const data = await import("@/features/tasks/data");
const { updateTag } = await import("next/cache");
const { reportError } = await import("@/lib/observability");
const { createSubtask, createTask, deleteSubtask, deleteTask, setSubtaskDone, setTaskDone, updateSubtask, updateTask } =
  await import("@/features/tasks/actions");
const { idle } = await import("@/lib/action-result");

const TASK_ID = "cjld2cjxh0000qzrmn831i7rn";
const dto = {
  id: TASK_ID,
  title: "Ship",
  notes: null,
  done: false,
  dueDate: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  subtasks: [],
};
const SUBTASK_ID = "cjld2cyuq0000t3rmniod1foy";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("createTask", () => {
  it("returns field errors and echoes values without touching the database", async () => {
    const result = await createTask(idle, form({ title: "  ", notes: "keep me" }));
    expect(result).toMatchObject({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Give the task a title."] },
      values: { title: "  ", notes: "keep me" },
    });
    expect(data.createTaskForOwner).not.toHaveBeenCalled();
  });

  it("creates for the session user, ignoring any ownerId sent by the client", async () => {
    vi.mocked(data.createTaskForOwner).mockResolvedValue(dto);
    const result = await createTask(idle, form({ title: "Ship", ownerId: "user-b" }));
    expect(result).toEqual({ ok: true, data: dto, message: "Task added." });
    expect(data.createTaskForOwner).toHaveBeenCalledWith("user-a", { title: "Ship", notes: null, dueDate: null });
    expect(updateTag).toHaveBeenCalledWith("tasks:user-a");
  });

  it("reports unexpected errors and returns a generic message", async () => {
    vi.mocked(data.createTaskForOwner).mockRejectedValue(new Error("connection reset"));
    const result = await createTask(idle, form({ title: "Ship" }));
    expect(result).toMatchObject({ ok: false, error: "Something went wrong. Please try again." });
    expect(reportError).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("connection reset");
  });
});

describe("updateTask", () => {
  it("returns not found when the task isn't the viewer's", async () => {
    vi.mocked(data.updateTaskForOwner).mockResolvedValue(null);
    const result = await updateTask(idle, form({ id: TASK_ID, title: "Edited" }));
    expect(result).toEqual({ ok: false, error: "That task no longer exists." });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("rejects a malformed id as a field error", async () => {
    const result = await updateTask(idle, form({ id: "../../etc", title: "Edited" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.id).toBeTruthy();
  });
});

describe("setTaskDone / deleteTask", () => {
  it("toggles through the owner-scoped data layer", async () => {
    vi.mocked(data.setTaskDoneForOwner).mockResolvedValue("ok");
    await expect(setTaskDone(TASK_ID, true)).resolves.toMatchObject({ ok: true });
    expect(data.setTaskDoneForOwner).toHaveBeenCalledWith("user-a", TASK_ID, true);
  });

  it("refuses to complete a task with open subtasks", async () => {
    vi.mocked(data.setTaskDoneForOwner).mockResolvedValue("open_subtasks");
    await expect(setTaskDone(TASK_ID, true)).resolves.toEqual({ ok: false, error: "Finish every subtask first." });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns not found for someone else's task", async () => {
    vi.mocked(data.setTaskDoneForOwner).mockResolvedValue("not_found");
    await expect(setTaskDone(TASK_ID, true)).resolves.toEqual({ ok: false, error: "That task no longer exists." });
  });

  it("validates arguments because actions are public endpoints", async () => {
    // @ts-expect-error: simulating a forged request
    await expect(setTaskDone(TASK_ID, "true")).resolves.toMatchObject({ ok: false });
    await expect(deleteTask("'; drop table")).resolves.toMatchObject({ ok: false });
    expect(data.setTaskDoneForOwner).not.toHaveBeenCalled();
    expect(data.deleteTaskForOwner).not.toHaveBeenCalled();
  });

  it("deletes and confirms", async () => {
    vi.mocked(data.deleteTaskForOwner).mockResolvedValue(true);
    await expect(deleteTask(TASK_ID)).resolves.toEqual({ ok: true, data: undefined, message: "Task deleted." });
  });
});

describe("subtask actions", () => {
  const subtask = { id: SUBTASK_ID, title: "Step one", done: false };

  it("creates for the session user and refreshes the task list", async () => {
    vi.mocked(data.createSubtaskForOwner).mockResolvedValue(subtask);
    const result = await createSubtask(idle, form({ taskId: TASK_ID, title: "  Step one " }));
    expect(result).toEqual({ ok: true, data: subtask, message: undefined });
    expect(data.createSubtaskForOwner).toHaveBeenCalledWith("user-a", { taskId: TASK_ID, title: "Step one" });
    expect(updateTag).toHaveBeenCalledWith("tasks:user-a");
  });

  it("returns field errors for a blank title without touching the database", async () => {
    const result = await createSubtask(idle, form({ taskId: TASK_ID, title: " " }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { title: ["Give the subtask a title."] } });
    expect(data.createSubtaskForOwner).not.toHaveBeenCalled();
  });

  it("maps a missing task and the per-task limit to friendly errors", async () => {
    vi.mocked(data.createSubtaskForOwner).mockResolvedValueOnce("not_found").mockResolvedValueOnce("limit");
    await expect(createSubtask(idle, form({ taskId: TASK_ID, title: "x" }))).resolves.toEqual({
      ok: false,
      error: "That task no longer exists.",
    });
    await expect(createSubtask(idle, form({ taskId: TASK_ID, title: "x" }))).resolves.toMatchObject({
      ok: false,
      error: "A task can have up to 50 subtasks.",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("renames, toggles and deletes through the owner-scoped data layer", async () => {
    vi.mocked(data.updateSubtaskForOwner).mockResolvedValue({ ...subtask, title: "Renamed" });
    vi.mocked(data.setSubtaskDoneForOwner).mockResolvedValue(true);
    vi.mocked(data.deleteSubtaskForOwner).mockResolvedValue(true);

    await expect(updateSubtask(idle, form({ id: SUBTASK_ID, title: "Renamed" }))).resolves.toMatchObject({ ok: true });
    expect(data.updateSubtaskForOwner).toHaveBeenCalledWith("user-a", { id: SUBTASK_ID, title: "Renamed" });
    await expect(setSubtaskDone(SUBTASK_ID, true)).resolves.toMatchObject({ ok: true });
    expect(data.setSubtaskDoneForOwner).toHaveBeenCalledWith("user-a", SUBTASK_ID, true);
    await expect(deleteSubtask(SUBTASK_ID)).resolves.toEqual({
      ok: true,
      data: undefined,
      message: "Subtask deleted.",
    });
  });

  it("returns not found when the subtask isn't the viewer's", async () => {
    vi.mocked(data.updateSubtaskForOwner).mockResolvedValue(null);
    vi.mocked(data.setSubtaskDoneForOwner).mockResolvedValue(false);
    vi.mocked(data.deleteSubtaskForOwner).mockResolvedValue(false);
    const notFound = { ok: false, error: "That subtask no longer exists." };
    await expect(updateSubtask(idle, form({ id: SUBTASK_ID, title: "x" }))).resolves.toEqual(notFound);
    await expect(setSubtaskDone(SUBTASK_ID, true)).resolves.toEqual(notFound);
    await expect(deleteSubtask(SUBTASK_ID)).resolves.toEqual(notFound);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("validates arguments and reports unexpected errors", async () => {
    // @ts-expect-error: simulating a forged request
    await expect(setSubtaskDone(SUBTASK_ID, "yes")).resolves.toMatchObject({ ok: false });
    await expect(deleteSubtask("not-an-id")).resolves.toMatchObject({ ok: false });
    expect(data.setSubtaskDoneForOwner).not.toHaveBeenCalled();

    vi.mocked(data.setSubtaskDoneForOwner).mockRejectedValue(new Error("deadlock"));
    const result = await setSubtaskDone(SUBTASK_ID, false);
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(reportError).toHaveBeenCalledOnce();
  });
});
