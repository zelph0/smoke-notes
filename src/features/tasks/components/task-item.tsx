"use client";

import { CalendarIcon, ListChecksIcon, ListPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { openSubtaskCount, type TaskDTO } from "../types";
import { SubtaskList } from "./subtask-list";
import { TaskForm } from "./task-form";

// Fixed locale + UTC: identical on server and client, so no hydration mismatch.
const dueFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDue(dueDate: string) {
  return dueFormat.format(new Date(`${dueDate}T00:00:00Z`));
}

type Props = {
  task: TaskDTO;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onToggleSubtask?: (id: string, done: boolean) => void;
  onDeleteSubtask?: (id: string) => void;
};

const noop = () => {};

export function TaskItem({ task, onToggle, onDelete, onToggleSubtask = noop, onDeleteSubtask = noop }: Props) {
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const closeEditor = useCallback(() => setEditing(false), []);
  const addSubtaskButton = useRef<HTMLButtonElement>(null);
  const stopAddingSubtask = useCallback(() => {
    // Move focus before the input unmounts, so keyboard users don't land on <body>.
    addSubtaskButton.current?.focus();
    setAddingSubtask(false);
  }, []);
  const checkboxId = `task-${task.id}`;
  const progressId = `${checkboxId}-progress`;
  const total = task.subtasks.length;
  const open = openSubtaskCount(task);
  // A task with open subtasks can't be completed (the server enforces it too). Reopening is always allowed.
  const blocked = !task.done && open > 0;

  return (
    <li data-testid="task-item" data-done={task.done} className="group flex flex-col py-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={task.done}
          disabled={blocked}
          onCheckedChange={(checked) => onToggle(task.id, checked === true)}
          aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          aria-describedby={total > 0 ? progressId : undefined}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={checkboxId}
            className={cn(
              "block break-words font-medium leading-snug transition-colors group-data-[done=true]:text-muted-foreground group-data-[done=true]:line-through",
              blocked ? "cursor-default" : "cursor-pointer",
            )}
          >
            {task.title}
          </label>
          {task.notes ? (
            <p className="mt-0.5 whitespace-pre-line break-words text-muted-foreground text-sm">{task.notes}</p>
          ) : null}
          {task.dueDate ? (
            <p className="mt-1 inline-flex items-center gap-1 text-muted-foreground text-xs">
              <CalendarIcon aria-hidden="true" className="size-3" />
              <span>
                Due <time dateTime={task.dueDate}>{formatDue(task.dueDate)}</time>
              </span>
            </p>
          ) : null}
          {total > 0 ? (
            <p id={progressId} aria-live="polite" className="mt-1 flex items-start gap-1 text-muted-foreground text-xs">
              <ListChecksIcon aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              <span>
                {total - open} of {total} {total === 1 ? "subtask" : "subtasks"} done
                {blocked ? " · finish them all to complete this task" : null}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add a subtask to "${task.title}"`}
            aria-expanded={addingSubtask}
            data-subtask-add=""
            ref={addSubtaskButton}
            onClick={() => setAddingSubtask((open) => !open)}
          >
            <ListPlusIcon />
          </Button>

          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Edit "${task.title}"`} />}>
              <PencilIcon />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
              </DialogHeader>
              <TaskForm mode="edit" task={task} onDone={closeEditor} />
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Delete "${task.title}"`} />}
            >
              <Trash2Icon />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{task.title}"{total > 0 ? ` and its ${total === 1 ? "subtask" : `${total} subtasks`}` : null} will be
                  removed. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => onDelete(task.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <SubtaskList
        task={task}
        adding={addingSubtask}
        onStopAdding={stopAddingSubtask}
        onToggle={onToggleSubtask}
        onDelete={onDeleteSubtask}
      />
    </li>
  );
}
