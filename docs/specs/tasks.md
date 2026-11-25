# Spec: Tasks (reference feature)

Status: shipped with the template. It's the pattern every feature copies.

## Problem

A signed-in user keeps a personal list of things to do and checks them off. It exists mainly to show,
end to end, how features are built in this codebase.

## Behaviour

- `/tasks` is private. Unauthenticated visitors are sent to sign-in and back again afterwards.
- Create a task with a title (required, ≤ 200 chars), optional notes (≤ 2000) and an optional due date.
- Validation runs on the server (the same Zod schema runs on the client). Errors show under each field.
  Submitted values are kept.
- List: open tasks first, newest first, max 200. Filter **All / Active / Done** via `?filter=`, with counts.
- Check off / reopen instantly (optimistic). On failure the change is undone and a toast explains.
- Edit title, notes and due date in a dialog. Delete with confirmation.
- States: loading skeleton, "No tasks yet", filtered-empty ("All done" / "Nothing finished yet"), and an
  error boundary with retry.

## Authorization

A user only ever sees and changes their own tasks. Every query is scoped by `ownerId = viewer.id`.
Updating or deleting someone else's task id behaves exactly like a missing task.

## Definition of done

- [x] Prisma model + migration (`Task`, index on `ownerId, status, createdAt desc`)
- [x] Zod schemas shared by form and actions; server actions return `ActionResult`
- [x] Loading, empty, filtered-empty and error states
- [x] Unit tests: schemas, actions (validation, ownership, unexpected errors), components
- [x] Integration tests: data layer, plus user A can't read/edit/complete/delete user B's tasks
- [x] Playwright: create → validate → edit → complete → filter → reload → delete; axe on `/tasks`
- [x] Works with and without the auth module

## Out of scope

Sharing, due-date reminders, ordering by drag and drop, pagination beyond 200.
