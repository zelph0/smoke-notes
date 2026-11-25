"use server";

import { updateTag } from "next/cache";
import { type ActionResult, failure, formValues, invalid, success } from "@/lib/action-result";
import { reportError } from "@/lib/observability";
import { requireViewer } from "@/lib/viewer";
import {
  createSubtaskForOwner,
  createTaskForOwner,
  deleteSubtaskForOwner,
  deleteTaskForOwner,
  setSubtaskDoneForOwner,
  setTaskDoneForOwner,
  updateSubtaskForOwner,
  updateTaskForOwner,
} from "./data";
import { tasksTag } from "./queries";
import {
  createSubtaskSchema,
  createTaskSchema,
  SUBTASKS_PER_TASK_MAX,
  setSubtaskDoneSchema,
  setTaskDoneSchema,
  subtaskIdSchema,
  taskIdSchema,
  updateSubtaskSchema,
  updateTaskSchema,
} from "./schema";
import type { SubtaskDTO, TaskDTO } from "./types";

/*
 * Server actions are public HTTP endpoints. Every action:
 *   1. resolves the viewer from the session (never trusts an owner id from the client),
 *   2. validates input with the shared Zod schema,
 *   3. writes through the owner-scoped data layer,
 *   4. invalidates the owner's cache tag,
 *   5. returns an ActionResult. Expected failures never throw to the client.
 */

const NOT_FOUND = "That task no longer exists.";
const SUBTASK_NOT_FOUND = "That subtask no longer exists.";
const OPEN_SUBTASKS = "Finish every subtask first.";
const UNEXPECTED = "Something went wrong. Please try again.";

/** Form action (useActionState): create a task. */
export async function createTask(_prev: ActionResult<TaskDTO>, formData: FormData): Promise<ActionResult<TaskDTO>> {
  const viewer = await requireViewer();
  const values = formValues(formData);
  const parsed = createTaskSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  try {
    const task = await createTaskForOwner(viewer.id, parsed.data);
    updateTag(tasksTag(viewer.id));
    return success(task, "Task added.");
  } catch (error) {
    reportError(error, { action: "createTask" });
    return failure(UNEXPECTED, { values });
  }
}

/** Form action (useActionState): edit title, notes and due date. */
export async function updateTask(_prev: ActionResult<TaskDTO>, formData: FormData): Promise<ActionResult<TaskDTO>> {
  const viewer = await requireViewer();
  const values = formValues(formData);
  const parsed = updateTaskSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  try {
    const task = await updateTaskForOwner(viewer.id, parsed.data);
    if (!task) return failure(NOT_FOUND);
    updateTag(tasksTag(viewer.id));
    return success(task, "Task saved.");
  } catch (error) {
    reportError(error, { action: "updateTask" });
    return failure(UNEXPECTED, { values });
  }
}

/** Called from an optimistic checkbox, not a form. */
export async function setTaskDone(id: string, done: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = setTaskDoneSchema.safeParse({ id, done });
  if (!parsed.success) return failure(NOT_FOUND);

  try {
    const outcome = await setTaskDoneForOwner(viewer.id, parsed.data.id, parsed.data.done);
    if (outcome === "not_found") return failure(NOT_FOUND);
    if (outcome === "open_subtasks") return failure(OPEN_SUBTASKS);
    updateTag(tasksTag(viewer.id));
    return success(undefined);
  } catch (error) {
    reportError(error, { action: "setTaskDone" });
    return failure(UNEXPECTED);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = taskIdSchema.safeParse(id);
  if (!parsed.success) return failure(NOT_FOUND);

  try {
    const found = await deleteTaskForOwner(viewer.id, parsed.data);
    if (!found) return failure(NOT_FOUND);
    updateTag(tasksTag(viewer.id));
    return success(undefined, "Task deleted.");
  } catch (error) {
    reportError(error, { action: "deleteTask" });
    return failure(UNEXPECTED);
  }
}

/** Form action (useActionState): add a subtask. Reopens the task if it was done. */
export async function createSubtask(
  _prev: ActionResult<SubtaskDTO>,
  formData: FormData,
): Promise<ActionResult<SubtaskDTO>> {
  const viewer = await requireViewer();
  const values = formValues(formData);
  const parsed = createSubtaskSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  try {
    const result = await createSubtaskForOwner(viewer.id, parsed.data);
    if (result === "not_found") return failure(NOT_FOUND);
    if (result === "limit") return failure(`A task can have up to ${SUBTASKS_PER_TASK_MAX} subtasks.`, { values });
    updateTag(tasksTag(viewer.id));
    return success(result);
  } catch (error) {
    reportError(error, { action: "createSubtask" });
    return failure(UNEXPECTED, { values });
  }
}

/** Form action (useActionState): rename a subtask. */
export async function updateSubtask(
  _prev: ActionResult<SubtaskDTO>,
  formData: FormData,
): Promise<ActionResult<SubtaskDTO>> {
  const viewer = await requireViewer();
  const values = formValues(formData);
  const parsed = updateSubtaskSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  try {
    const subtask = await updateSubtaskForOwner(viewer.id, parsed.data);
    if (!subtask) return failure(SUBTASK_NOT_FOUND);
    updateTag(tasksTag(viewer.id));
    return success(subtask);
  } catch (error) {
    reportError(error, { action: "updateSubtask" });
    return failure(UNEXPECTED, { values });
  }
}

/** Called from an optimistic checkbox. Reopening a subtask reopens its task. */
export async function setSubtaskDone(id: string, done: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = setSubtaskDoneSchema.safeParse({ id, done });
  if (!parsed.success) return failure(SUBTASK_NOT_FOUND);

  try {
    const found = await setSubtaskDoneForOwner(viewer.id, parsed.data.id, parsed.data.done);
    if (!found) return failure(SUBTASK_NOT_FOUND);
    updateTag(tasksTag(viewer.id));
    return success(undefined);
  } catch (error) {
    reportError(error, { action: "setSubtaskDone" });
    return failure(UNEXPECTED);
  }
}

export async function deleteSubtask(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = subtaskIdSchema.safeParse(id);
  if (!parsed.success) return failure(SUBTASK_NOT_FOUND);

  try {
    const found = await deleteSubtaskForOwner(viewer.id, parsed.data);
    if (!found) return failure(SUBTASK_NOT_FOUND);
    updateTag(tasksTag(viewer.id));
    return success(undefined, "Subtask deleted.");
  } catch (error) {
    reportError(error, { action: "deleteSubtask" });
    return failure(UNEXPECTED);
  }
}
