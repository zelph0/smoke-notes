"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type ActionResult, idle } from "@/lib/action-result";
import { createSubtask, updateSubtask } from "../actions";
import { SUBTASK_TITLE_MAX } from "../schema";
import type { SubtaskDTO } from "../types";

type Props = (
  | { mode: "create"; taskId: string; taskTitle: string; subtask?: undefined }
  | { mode: "rename"; subtask: SubtaskDTO; taskId?: undefined; taskTitle?: undefined }
) & { onClose: () => void };

/**
 * Inline one-field form for adding or renaming a subtask. Same pattern as TaskForm, smaller:
 * Enter submits, Escape closes. After an add it stays open and focused for the next subtask.
 */
export function SubtaskForm({ mode, taskId, taskTitle, subtask, onClose }: Props) {
  const action = mode === "create" ? createSubtask : updateSubtask;
  const [state, formAction, pending] = useActionState<ActionResult<SubtaskDTO>, FormData>(action, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastHandled = useRef<ActionResult<SubtaskDTO>>(idle);
  const id = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      if (mode === "create") {
        formRef.current?.reset();
        inputRef.current?.focus();
      } else {
        onClose();
      }
    } else if (state.error && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, mode, onClose]);

  const error = state.ok ? undefined : state.fieldErrors?.title?.[0];
  const value = state.ok ? undefined : state.values?.title;
  const inputId = `${id}-title`;
  const errorId = `${id}-title-error`;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-label={mode === "create" ? `Add a subtask to "${taskTitle}"` : `Rename subtask "${subtask.title}"`}
      className="flex w-full items-start gap-2"
    >
      {mode === "create" ? (
        <input type="hidden" name="taskId" value={taskId} />
      ) : (
        <input type="hidden" name="id" value={subtask.id} />
      )}
      <Field data-invalid={error ? true : undefined} className="flex-1">
        <FieldLabel htmlFor={inputId} className="sr-only">
          {mode === "create" ? "New subtask" : "Subtask title"}
        </FieldLabel>
        <Input
          ref={inputRef}
          id={inputId}
          name="title"
          placeholder={mode === "create" ? "Add a subtask" : undefined}
          maxLength={SUBTASK_TITLE_MAX}
          defaultValue={value ?? subtask?.title ?? ""}
          autoComplete="off"
          required
          className="h-control-sm"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          {...(error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {})}
        />
        <FieldError id={errorId}>{error}</FieldError>
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {mode === "create" ? "Add" : "Save"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        {mode === "create" ? "Done" : "Cancel"}
      </Button>
    </form>
  );
}
