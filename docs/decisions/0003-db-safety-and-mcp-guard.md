# 0003: Database safety: branches, MCP guard, migrations only via PR

Date: 2026-11-24 · Status: accepted

**Context.** Claude has Neon MCP access. The hosted MCP can be scoped to a project
(`?projectId=`) but not to a branch, and its `complete_database_migration` applies changes to the
default (production) branch.

**Decision.**
- Branches: `main` = production, `dev` = local development, `test` = disposable branch for local tests
  (`pnpm db:test`), `ci/<run>` = per CI run (deleted after, expires in 2h anyway), `preview/<git-branch>` =
  per PR via the Neon <> Vercel integration (deleted on PR close).
- `.claude/hooks/neon-guard.ts` (PreToolUse) allows reads anywhere and writes on non-production branches.
  It denies production writes, resets and deletes, and Neon-applied migrations, and asks for project-level tools.
  No `branchId` = production.
- Schema changes ship only as Prisma migration files in a PR. `migrate-prod.yml` applies them after merge,
  before the production deploy. Settings deny `prisma migrate reset` / `db push` and reading `.env*.local`.

**Consequences.**
- The hook is a guardrail, not a security boundary: the MCP OAuth grant still has project-wide rights. For
  stronger isolation, connect the MCP with a `roleName` whose grants are read-only on production.
- Private repos on a free GitHub plan can't enforce branch protection; apps made from this template
  should be public or on GitHub Pro.
