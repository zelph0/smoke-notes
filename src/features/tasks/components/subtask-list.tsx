"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { SubtaskDTO, TaskDTO } from "../types";
import { SubtaskForm } from "./subtask-form";

type Props = {
  task: TaskDTO;
  adding: boolean;
  onStopAdding: () => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
};

/** The checklist under a task: its subtasks plus, while `adding`, the inline add form. */
export function SubtaskList({ task, adding, onStopAdding, onToggle, onDelete }: Props) {
  if (task.subtasks.length === 0 && !adding) return null;

  return (
    // ml-7 lines the checklist up with the task title (checkbox width + gap).
    <div className="mt-2 ml-7 flex flex-col gap-1">
      {task.subtasks.length > 0 ? (
        <ul aria-label={`Subtasks of "${task.title}"`} className="flex flex-col">
          {task.subtasks.map((subtask) => (
            <SubtaskItem key={subtask.id} subtask={subtask} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </ul>
      ) : null}
      {adding ? <SubtaskForm mode="create" taskId={task.id} taskTitle={task.title} onClose={onStopAdding} /> : null}
    </div>
  );
}

type ItemProps = {
  subtask: SubtaskDTO;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
};

export function SubtaskItem({ subtask, onToggle, onDelete }: ItemProps) {
  const [renaming, setRenaming] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const refocusRename = useRef(false);
  const stopRenaming = useCallback(() => {
    refocusRename.current = true;
    setRenaming(false);
  }, []);

  // The rename button remounts when the form closes; put focus back on it.
  useEffect(() => {
    if (!renaming && refocusRename.current) {
      refocusRename.current = false;
      renameButton.current?.focus();
    }
  }, [renaming]);

  function remove(event: React.MouseEvent<HTMLButtonElement>) {
    // The row is about to disappear: move focus to the next (or previous) subtask, else the task's add button.
    const row = event.currentTarget.closest("li");
    const sibling = row?.nextElementSibling ?? row?.previousElementSibling;
    const target =
      sibling?.querySelector<HTMLElement>('[role="checkbox"]') ??
      row?.closest('[data-testid="task-item"]')?.querySelector<HTMLElement>("[data-subtask-add]");
    target?.focus();
    onDelete(subtask.id);
  }
  const checkboxId = `subtask-${subtask.id}`;

  if (renaming) {
    return (
      <li data-testid="subtask-item" className="py-1">
        <SubtaskForm mode="rename" subtask={subtask} onClose={stopRenaming} />
      </li>
    );
  }

  return (
    <li data-testid="subtask-item" data-done={subtask.done} className="group/subtask flex items-center gap-2 py-1">
      <Checkbox
        id={checkboxId}
        checked={subtask.done}
        onCheckedChange={(checked) => onToggle(subtask.id, checked === true)}
        aria-label={
          subtask.done ? `Mark subtask "${subtask.title}" as not done` : `Mark subtask "${subtask.title}" as done`
        }
      />
      <label
        htmlFor={checkboxId}
        className="min-w-0 flex-1 cursor-pointer break-words text-sm leading-snug transition-colors group-data-[done=true]/subtask:text-muted-foreground group-data-[done=true]/subtask:line-through"
      >
        {subtask.title}
      </label>
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within/subtask:opacity-100 sm:group-hover/subtask:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Rename subtask "${subtask.title}"`}
          ref={renameButton}
          onClick={() => setRenaming(true)}
        >
          <PencilIcon />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={`Delete subtask "${subtask.title}"`} onClick={remove}>
          <XIcon />
        </Button>
      </div>
    </li>
  );
}
