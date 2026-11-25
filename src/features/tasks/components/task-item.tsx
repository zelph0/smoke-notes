"use client";

import { CalendarIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
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
import type { TaskDTO } from "../types";
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
};

export function TaskItem({ task, onToggle, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const closeEditor = useCallback(() => setEditing(false), []);
  const checkboxId = `task-${task.id}`;

  return (
    <li data-testid="task-item" data-done={task.done} className="group flex items-start gap-3 py-3">
      <Checkbox
        id={checkboxId}
        checked={task.done}
        onCheckedChange={(checked) => onToggle(task.id, checked === true)}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={checkboxId}
          className="block cursor-pointer break-words font-medium leading-snug transition-colors group-data-[done=true]:text-muted-foreground group-data-[done=true]:line-through"
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
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
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
          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Delete "${task.title}"`} />}>
            <Trash2Icon />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription>"{task.title}" will be removed. This can't be undone.</AlertDialogDescription>
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
    </li>
  );
}
