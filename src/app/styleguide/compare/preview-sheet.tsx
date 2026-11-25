"use client";

import { useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TasksEmptyState } from "@/features/tasks/components/empty-state";
import { TaskFilterNav } from "@/features/tasks/components/task-filter";
import { TaskForm } from "@/features/tasks/components/task-form";
import { TaskItem } from "@/features/tasks/components/task-item";
import { TaskListSkeleton } from "@/features/tasks/components/task-list-skeleton";
import type { TaskDTO } from "@/features/tasks/types";
import { SignInForm } from "@/modules/auth/components/sign-in-form"; // @auth-module

const TASKS: TaskDTO[] = [
  {
    id: "preview-1",
    title: "Draft the launch announcement",
    notes: "Keep it under 200 words.",
    done: false,
    dueDate: "2026-12-04",
    createdAt: "2026-11-20T09:00:00.000Z",
  },
  {
    id: "preview-2",
    title: "Book the venue",
    notes: null,
    done: true,
    dueDate: null,
    createdAt: "2026-11-18T09:00:00.000Z",
  },
  {
    id: "preview-3",
    title: "A much longer task title that wraps onto a second line so you can judge the line height",
    notes: null,
    done: false,
    dueDate: "2026-11-01",
    createdAt: "2026-11-10T09:00:00.000Z",
  },
];

const noop = () => {};

/**
 * The app's real UI with sample data, rendered once per style candidate on /styleguide/compare.
 * Task rows are inert: their edit/delete dialogs would portal out of the candidate's scope. The
 * add-task form and the sign-in card stay live (they hit the dev database / Neon Auth) so focus
 * and validation states can be tried; submit them only on purpose.
 */
export function PreviewSheet({ id }: { id: string }) {
  const scope = useRef<HTMLDivElement>(null);
  const field = (name: string) => `${id}-${name}`;

  return (
    <div ref={scope} className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-heading text-3xl">Plan the week</p>
        <p className="text-muted-foreground">Body text and muted supporting text in this direction's type.</p>
      </div>

      <Block title="Tasks">
        <TaskFilterNav current="all" counts={{ all: 3, active: 2, done: 1 }} />
        <TaskForm
          mode="create"
          initialState={{ ok: false, error: "Check the highlighted field.", fieldErrors: { title: ["Add a title."] } }}
        />
        <ul className="divide-y divide-border" inert>
          {TASKS.map((task) => (
            // Ids feed element ids (checkbox labels): keep them unique across candidates.
            <TaskItem key={task.id} task={{ ...task, id: `${id}-${task.id}` }} onToggle={noop} onDelete={noop} />
          ))}
        </ul>
        <TasksEmptyState filter="done" total={3} />
        <TaskListSkeleton rows={2} />
      </Block>

      <Block title="Buttons, badges, inputs">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Overdue</Badge>
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={field("name")}>Name</FieldLabel>
            <Input id={field("name")} name="name" autoComplete="off" placeholder="Ada Lovelace…" />
            <FieldDescription>Helper text under the input.</FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor={field("email")}>Email</FieldLabel>
            <Input
              id={field("email")}
              name="email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              defaultValue="not-an-email"
              aria-invalid
              aria-describedby={field("email-error")}
            />
            <FieldError id={field("email-error")}>Enter a valid email address.</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={field("notes")}>Notes</FieldLabel>
            <Textarea id={field("notes")} name="notes" placeholder="Longer text…" />
          </Field>
          <Field>
            <FieldLabel htmlFor={field("disabled")}>Disabled</FieldLabel>
            <Input id={field("disabled")} disabled placeholder="Can't edit" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id={field("check")} defaultChecked />
            <FieldLabel htmlFor={field("check")}>Email me reminders</FieldLabel>
          </Field>
        </FieldGroup>
      </Block>

      <Block title="Surfaces">
        <Card>
          <CardHeader>
            <CardTitle>Weekly summary</CardTitle>
            <CardDescription>2 tasks left, 1 done.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>Neutral alert for information.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Couldn't save</AlertTitle>
              <AlertDescription>Destructive alert for errors.</AlertDescription>
            </Alert>
            <div role="status" aria-label="Loading placeholder" className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
              <DialogContent container={scope}>
                <DialogHeader>
                  <DialogTitle>Delete this task?</DialogTitle>
                  <DialogDescription>This can't be undone.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <DialogClose render={<Button variant="destructive" />}>Delete</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button>Save summary</Button>
          </CardFooter>
        </Card>
      </Block>

      {/* @auth-module:start */}
      <Block title="Sign-in card">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>New here? Signing in creates your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm next="/" />
          </CardContent>
        </Card>
      </Block>
      {/* @auth-module:end */}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="border-b-(length:--border-width) border-border pb-2 font-heading text-lg">{title}</h3>
      {children}
    </section>
  );
}
