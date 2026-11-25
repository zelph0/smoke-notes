---
name: migrate
description: Change the database schema safely. Use whenever a task needs a new/changed Prisma model, column, index or enum, or asks to "add a field", "change the schema", "write a migration", or roll one back. Covers creating the migration on the Neon dev branch, testing it on a throwaway branch, shipping it in a PR, how production gets it, and rollback.
---

# Migrate: schema changes from dev branch to production

Schema changes ship **only** as Prisma migration files in a PR. Never apply anything to
production from a machine or the Neon MCP (the `neon-guard` hook blocks it).

## 1. Design the change (expand / contract)

Production runs old code while a migration applies, and previews run against their own branch.
Every migration must be safe for the **currently deployed** code:

- Add columns as nullable or with a default. Backfill in a later step if needed.
- Never rename or drop in one step: add the new thing → deploy code using it → drop the old
  thing in a later PR.
- Make enum changes additive only.
- Create indexes on big tables with `CREATE INDEX CONCURRENTLY`. Edit the generated SQL and put it in its own migration.

## 2. Create it on the dev branch

```bash
# edit prisma/schema.prisma first
pnpm db:migrate --name <short_snake_case_change> --create-only   # writes SQL, doesn't apply
```

Read `prisma/migrations/<timestamp>_<name>/migration.sql` and check it matches step 1. Then apply:

```bash
pnpm db:migrate        # applies to the Neon dev branch (.env.local) and regenerates the client
```

Ignore Prisma's "update available → 8.x" banner: the repo is pinned to 7 (docs/decisions/0001).

## 3. Prove it on a throwaway branch (from production's schema)

```bash
pnpm db:test               # resets the `test` branch to main, applies ALL migrations, seeds
pnpm test:integration      # data layer + authorization tests against it
pnpm db:check              # exit code 2 = schema.prisma has changes with no migration
```

`db:test` replays the migration history from main's state, which is exactly what CI and
production will do. If it fails here, it will fail in production.

## 4. Ship it

- Update the feature code, Zod schemas and tests in the **same PR** as the migration.
- In the PR description, paste the migration SQL and the commands you ran (template asks for it).
- CI: creates a branch per run, runs `prisma migrate deploy` + `db:check`, all tests, both auth variants.
- Preview deploy: Vercel's build runs `prisma migrate deploy` against the PR's own Neon preview branch.

## 5. How production gets it (no manual step)

After merge, `.github/workflows/migrate-prod.yml` runs `prisma migrate deploy` against the
production branch **before** the production deploy is promoted. If the migration fails, the deploy is not promoted.

## 6. Roll back

Prisma has no automatic down migrations. In order of preference:

1. **Code-only problem:** revert the code PR. With expand/contract the schema stays compatible.
2. **Bad migration, data intact:** write a forward "down" migration that undoes it
   (`pnpm db:migrate --name revert_<change> --create-only`, hand-write the inverse SQL) and ship it as a PR.
3. **Data damaged:** Neon instant restore. Restore the production branch to a timestamp just before the
   migration (Console → Branches → main → Restore, or
   `pnpm exec neon branches restore main ^self@<ISO timestamp> --preserve-under-name main-before-restore`).
   The Free plan keeps 6 hours of history; Launch keeps up to 7 days. Then mark the migration as rolled back:
   `pnpm prisma migrate resolve --rolled-back <migration_name>` against production (a human runs this).

Never `prisma migrate reset` or `prisma db push` (both are denied in `.claude/settings.json`).
