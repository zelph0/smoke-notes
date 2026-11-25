# 0011: Subtasks are their own table; the completion rule is enforced under a row lock

Date: 2026-11-25 · Status: accepted

**Context.** Tasks gain subtasks (`docs/specs/subtasks.md`), and a task may only be done when every
subtask is done. Subtasks are title-only checklist items, one level deep.

**Decision.**
- A separate `Subtask` table (FK to `Task`, cascade delete) instead of a self-referencing `Task.parentId`.
  Subtasks don't share Task's fields, filters or counts, and a separate table keeps the existing Task
  queries and the list index unchanged. Ownership comes from the task (`task.ownerId`), so there is no
  second owner column that could drift.
- The rule "DONE ⇒ no open subtasks" is enforced in `data.ts`, not only in the UI. Writes that could break it
  (complete a task, reopen a subtask, add a subtask) run in a transaction that first takes
  `SELECT … FOR UPDATE` on the task row. Concurrent writes to one task then serialize, and each sees
  the other's committed result. Reopening or adding a subtask reopens a done task in the same transaction.
- The UI mirrors the rule (disabled checkbox, optimistic reducer) so it never shows a state the server would refuse.

**Consequences.** These writes take a few extra round trips (lock, check, write). Deleting a subtask can't
break the rule and stays a single statement. A Postgres check constraint can't express a rule that spans two
tables, so the rule lives in code. Its integration tests cover it, including a concurrent-write case.
