"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, idle } from "@/lib/action-result";
import { createTask, updateTask } from "../actions";
import { TASK_NOTES_MAX, TASK_TITLE_MAX } from "../schema";
import type { TaskDTO } from "../types";

type Props = (
  | { mode: "create"; task?: undefined; onDone?: () => void }
  | { mode: "edit"; task: TaskDTO; onDone?: () => void }
) & {
  /** Start in this state instead of idle. Used by /styleguide/compare to show validation errors. */
  initialState?: ActionResult<TaskDTO>;
};

/**
 * One form for create and edit. Pattern to copy:
 * - `useActionState` with a server action that returns ActionResult
 * - field errors under each input, wired with aria-invalid / aria-describedby
 * - submitted values echoed back on failure (React resets the form after an action)
 * - pending state disables the submit button
 */
export function TaskForm({ mode, task, onDone, initialState = idle }: Props) {
  const action = mode === "create" ? createTask : updateTask;
  const [state, formAction, pending] = useActionState<ActionResult<TaskDTO>, FormData>(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const lastHandled = useRef<ActionResult<TaskDTO>>(initialState);

  useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (mode === "create") formRef.current?.reset();
      onDone?.();
    } else if (state.error && !state.fieldErrors) {
      // Field problems show inline; only form-level failures need a toast.
      toast.error(state.error);
    }
  }, [state, mode, onDone]);

  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.ok ? undefined : state.values;
  const fieldId = (name: string) => `${id}-${name}`;
  const errorId = (name: string) => `${id}-${name}-error`;
  const invalidProps = (name: string) =>
    errors?.[name]?.length ? { "aria-invalid": true as const, "aria-describedby": errorId(name) } : {};

  return (
    <form ref={formRef} action={formAction} noValidate aria-label={mode === "create" ? "Add a task" : "Edit task"}>
      {mode === "edit" ? <input type="hidden" name="id" value={task.id} /> : null}
      <FieldGroup className={mode === "create" ? "gap-3" : undefined}>
        <Field data-invalid={errors?.title ? true : undefined}>
          <FieldLabel htmlFor={fieldId("title")} className={mode === "create" ? "sr-only" : undefined}>
            Title
          </FieldLabel>
          <Input
            id={fieldId("title")}
            name="title"
            placeholder={mode === "create" ? "What needs doing?" : undefined}
            maxLength={TASK_TITLE_MAX}
            defaultValue={values?.title ?? task?.title ?? ""}
            autoComplete="off"
            required
            {...invalidProps("title")}
          />
          <FieldError id={errorId("title")}>{errors?.title?.[0]}</FieldError>
        </Field>

        <div className={mode === "create" ? "grid gap-3 sm:grid-cols-[1fr_auto]" : "grid gap-4"}>
          <Field data-invalid={errors?.notes ? true : undefined}>
            <FieldLabel htmlFor={fieldId("notes")} className={mode === "create" ? "sr-only" : undefined}>
              Notes
            </FieldLabel>
            <Textarea
              id={fieldId("notes")}
              name="notes"
              rows={mode === "create" ? 1 : 4}
              placeholder={mode === "create" ? "Notes (optional)" : undefined}
              maxLength={TASK_NOTES_MAX}
              defaultValue={values?.notes ?? task?.notes ?? ""}
              className={mode === "create" ? "min-h-control" : undefined}
              {...invalidProps("notes")}
            />
            <FieldError id={errorId("notes")}>{errors?.notes?.[0]}</FieldError>
          </Field>

          <Field data-invalid={errors?.dueDate ? true : undefined} className="sm:w-44">
            <FieldLabel htmlFor={fieldId("dueDate")} className={mode === "create" ? "sr-only" : undefined}>
              Due date
            </FieldLabel>
            <Input
              id={fieldId("dueDate")}
              name="dueDate"
              type="date"
              defaultValue={values?.dueDate ?? task?.dueDate ?? ""}
              {...invalidProps("dueDate")}
            />
            <FieldError id={errorId("dueDate")}>{errors?.dueDate?.[0]}</FieldError>
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          {mode === "edit" ? (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={pending}>
            {mode === "create" ? <PlusIcon data-icon="inline-start" /> : null}
            {pending ? "Saving…" : mode === "create" ? "Add task" : "Save changes"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
