# Spec: Subtasks

Status: built (feat/subtasks)

## Problem

Some tasks are really a handful of steps. A user wants to break a task into a checklist of
subtasks, and the task should only count as done once every step is done.

## Behaviour

- A subtask belongs to one task and has a title (required, ≤ 200 chars) and a done flag. No notes,
  due date or nesting. At most 50 subtasks per task.
- Subtasks show under their task, oldest first, with a "2 of 5 done" summary.
- Add a subtask inline from the task ("Add subtask" button reveals a small input; Enter adds, the input
  stays open for the next one, Escape closes it). Validation errors show under the input.
- Check off / reopen a subtask instantly (optimistic). Rename it inline. Delete it without confirmation.
- **Completing the parent:** a task with any open subtask can't be completed. Its checkbox is disabled
  and the summary explains why. The server enforces the same rule (it doesn't trust the client) and
  answers "Finish every subtask first."
- **Keeping "done" honest:** if a subtask of a done task is reopened, or a new subtask is added to a
  done task, the task goes back to not-done automatically.
- Deleting a task deletes its subtasks. Deleting the last open subtask leaves the task open; the user
  can then complete it.
- Filters and counts (All / Active / Done) still count tasks only.

## Authorization

Subtasks are scoped through their task: every query filters by `task.ownerId = viewer.id`.
Adding to, changing or deleting another user's subtask (or adding to another user's task) behaves exactly
like a missing one.

## Definition of done

- [x] `Subtask` model + additive migration (FK to `Task`, cascade delete, index on `taskId, createdAt`)
- [x] Zod schemas; server actions return `ActionResult`; `setTaskDone` rejects open subtasks
- [x] Owner-scoped data access + user-A-vs-user-B tests for every subtask action
- [x] Unit tests: schemas, actions, optimistic reducer, components (disabled parent checkbox)
- [x] Integration tests: data layer rules (blocked completion, auto-reopen, cascade delete)
- [x] Playwright: add subtasks → parent blocked → complete subtasks → complete parent → reopen subtask
      reopens parent → delete; axe on `/tasks` with subtasks shown
- [x] Migration follows expand/contract

## Out of scope

Nested subtasks, reordering, notes/due dates on subtasks, "complete all" shortcuts, subtask counts in filters.
