import type { z } from "zod";

/**
 * What every server action returns. Actions never throw to the client for expected
 * failures (validation, not found, not allowed); they return `ok: false` instead.
 * Unexpected errors are logged and reported (Sentry) and surface as `error`.
 */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors; values?: Record<string, string> };

/** Initial state for `useActionState` before the first submit. */
export const idle: ActionResult<never> = { ok: false, error: "" };

export function success<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function failure(error: string, extra?: Omit<Extract<ActionResult, { ok: false }>, "ok" | "error">) {
  return { ok: false, error, ...extra } as const;
}

/** Turns a failed Zod parse into field errors keyed by input name. */
export function invalid(error: z.ZodError, values?: Record<string, string>) {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return { ok: false, error: "Check the highlighted fields.", fieldErrors, values } as const;
}

/** FormData -> plain object of strings (files are ignored). Handy for echoing values back. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}
