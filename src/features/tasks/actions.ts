"use server";

import { updateTag } from "next/cache";
import { type ActionResult, failure, formValues, invalid, success } from "@/lib/action-result";
import { reportError } from "@/lib/observability";
import { requireViewer } from "@/lib/viewer";
import { createTaskForOwner, deleteTaskForOwner, setTaskDoneForOwner, updateTaskForOwner } from "./data";
import { tasksTag } from "./queries";
import { createTaskSchema, setTaskDoneSchema, taskIdSchema, updateTaskSchema } from "./schema";
import type { TaskDTO } from "./types";

/*
 * Server actions are public HTTP endpoints. Every action:
 *   1. resolves the viewer from the session (never trusts an owner id from the client),
 *   2. validates input with the shared Zod schema,
 *   3. writes through the owner-scoped data layer,
 *   4. invalidates the owner's cache tag,
 *   5. returns an ActionResult. Expected failures never throw to the client.
 */

const NOT_FOUND = "That task no longer exists.";
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
    const found = await setTaskDoneForOwner(viewer.id, parsed.data.id, parsed.data.done);
    if (!found) return failure(NOT_FOUND);
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
