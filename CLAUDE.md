# CLAUDE.md

Next.js 16 (App Router, Cache Components) · Prisma 7 on Neon · Neon Auth · Tailwind 4 + shadcn (Base UI) · Vitest · Playwright · Biome · pnpm 12 · Node 24.

@AGENTS.md

## Commands

- `pnpm dev`: app on the Neon `dev` branch (`.env.local`; `pnpm db:env` rewrites it, keeping custom values)
- `pnpm typecheck` / `pnpm lint` (`lint:fix` to autofix): the Stop hook runs both
- `pnpm test`: unit tests, no DB
- `pnpm db:test`: reset the disposable `test` branch (migrate + seed), then:
  - `pnpm test:integration` (DB tests)
  - `pnpm test:e2e` (Playwright: builds, starts on :3100)
- `pnpm db:migrate --name x --create-only`, then `pnpm db:migrate`: schema changes, via the `migrate` skill
- `pnpm provision <slug>` / `pnpm deprovision <slug>`: create / delete an app from this template (`docs/template-contract.md` §6)
- `pnpm db:seed`, `pnpm db:check` (fails if the schema has changes with no migration), `pnpm template:check`

## Build features by copying `src/features/tasks/`

`schema.ts` (Zod) → `data.ts` (owner-scoped Prisma) → `queries.ts` (cached reads) →
`actions.ts` (server actions) → `components/` → `src/app/(app)/<feature>/{page,loading,error}.tsx`
→ tests in `tests/{unit,integration,e2e}`. Write a spec in `docs/specs/<feature>.md` first.

- **Authorization:** get the user with `requireViewer()` from `@/lib/viewer`. Filter every query by `ownerId` in `data.ts`.
  Never accept an owner id from the client. Add a user-A-vs-user-B test.
- **Server actions** validate with Zod and return `ActionResult` (`@/lib/action-result`). Expected failures become `{ ok: false, error }`.
  Unexpected ones go through `reportError()` (Sentry when configured) and surface as a generic message.
- **Cache Components:** anything reading cookies/session/searchParams goes inside `<Suspense>`. Cached reads use
  `"use cache"` + `cacheTag(tasksTag(ownerId))`, and actions call `updateTag(...)`.
- Fetch data in Server Components. Use `"use client"` only for interactivity, and pass DTOs (not Prisma models) to the client.
- Pages are private by default (auth proxy). To make a page public, add it to `PUBLIC_ROUTES` in `src/modules/auth/proxy.ts`. <!-- @auth-module -->

<!-- @auth-module:start -->
## Auth (removable module)

All auth code lives in `src/modules/auth/`. Integration points are listed in `docs/template-contract.md`.
Features import only `@/lib/viewer`. Sign-in is email OTP + Google (Neon's shared dev credentials).
E2E logs in with seeded users (`src/modules/auth/testing/users.ts`); `pnpm auth:remove` deletes the module.
<!-- @auth-module:end -->

## Styling

Tokens live only in `src/styles/theme.css`, fonts in `src/config/fonts.ts`. Components use tokens and
`components/ui` variants, never hard-coded colours or sizes. Check `/styleguide` in light and dark. See `docs/theming.md`.
Restyling: compare candidates on `/styleguide/compare` (`STYLE_PREVIEW=1`), `pnpm style:check`, then `pnpm style:reset`.

## Database safety

- Claude may write to `dev`, `preview/*` and `test` branches. Production (`main`) is read-only: the
  `neon-guard` hook enforces it on the Neon MCP. Always pass the dev branch id to Neon MCP SQL tools.
- Production schema changes = Prisma migration files in a PR, applied by CI after merge. Use expand/contract.
- Never `prisma migrate reset` / `db push`, never edit an applied migration, never read `.env*.local`.

## Gotchas

- Prisma is pinned to 7.x. npm `latest` is a Prisma 8 RC with a different API; ignore the upgrade banner.
- The Prisma client is generated into `src/generated/prisma` (gitignored; `postinstall` regenerates it).
  `src/lib/db.ts` is server-only; scripts use `createPrismaClient()`.
- `error.tsx` receives `{ error, retry }` (Next 16.4), not `reset`.
- Base UI, not Radix: compose with `render={<Button />}`. Never render an `<a>` through Button; style a
  `<Link>` with `buttonVariants()` instead.
- pnpm 12 refuses packages less than a day old (`minimumReleaseAge`). Pick the previous release instead of disabling it.
- Placeholders (app name/slug/description) live in `template.config.ts`. After editing it, run `pnpm template:sync`.

## Workflow

- Branches: `feat/…`, `fix/…`, `chore/…`. Conventional Commits. Commit at each working milestone.
- Before a PR: run the `reviewer` agent; fill the PR template with the commands you ran and screenshots.
- Decisions (the "why") live in `docs/decisions/`. Add one when you make a non-obvious choice.
