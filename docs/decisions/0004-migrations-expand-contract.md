# 0004: Migrations are expand/contract, applied before deploy

Date: 2026-11-24 · Status: accepted

**Context.** Production migrations run in CI before the new code is promoted, so for a short time the
new schema serves the old code. Previews run new code on their own branch.

**Decision.**
- Every migration must work with the currently deployed code: additive changes first, removals in a later PR.
- Rollback = revert the code (schema stays compatible), a forward "down" migration, or Neon instant
  restore for data damage. Full procedure: `.claude/skills/migrate/SKILL.md`.

**Consequences.** Renames and type changes take two PRs. This is worth it for zero-downtime deploys.
