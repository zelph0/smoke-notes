import { z } from "zod";

/**
 * Validation for the Tasks feature. Shared by the client form (instant feedback) and the
 * server actions (the real gate). Inputs arrive as FormData strings, so every field is
 * parsed from a string here.
 */

export const TASK_TITLE_MAX = 200;
export const TASK_NOTES_MAX = 2000;

export const TASK_FILTERS = ["all", "active", "done"] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];

/** Unknown or missing ?filter= values fall back to "all" instead of erroring. */
export const taskFilterSchema = z.enum(TASK_FILTERS).catch("all");

export const taskIdSchema = z.cuid("Unknown task.");

const title = z
  .string("Give the task a title.")
  .trim()
  .min(1, "Give the task a title.")
  .max(TASK_TITLE_MAX, `Keep the title under ${TASK_TITLE_MAX} characters.`);

const notes = z
  .string()
  .trim()
  .max(TASK_NOTES_MAX, `Keep notes under ${TASK_NOTES_MAX} characters.`)
  .optional()
  .transform((value) => (value ? value : null));

/** "" -> null, "YYYY-MM-DD" -> Date at UTC midnight (stored as a Postgres DATE). */
const dueDate = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      ctx.addIssue({ code: "custom", message: "Use a valid date." });
      return z.NEVER;
    }
    return date;
  });

export const createTaskSchema = z.object({ title, notes, dueDate });
export type CreateTaskInput = z.output<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.extend({ id: taskIdSchema });
export type UpdateTaskInput = z.output<typeof updateTaskSchema>;

export const setTaskDoneSchema = z.object({ id: taskIdSchema, done: z.boolean() });
