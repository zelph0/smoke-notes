# Template contract

What the provisioning script (build step 2) and `/new-app` (step 3) may change, and how,
so they customize this template without rewriting it. If you change any of this, update this
file and the scripts that depend on it in the same PR.

## 1. Placeholders

App identity lives in **one** file: `template.config.ts`.

| Field | Used by |
|---|---|
| `name` | `<title>` + metadata, OG image, header, home page, README title |
| `slug` | `package.json` `name` (lowercase letters, digits, dashes) |
| `description` | `<meta name="description">`, OpenGraph, OG image, home page |
| `locale` | `<html lang>` |

Files that can't import TypeScript are kept in sync by `pnpm template:sync`:

- `package.json` → `"name"` = `slug`
- `README.md` → the line ending in `<!-- template:name -->` gets `name`

`pnpm template:check` (run in CI) fails if they drift.

**Provisioning:** rewrite the `name`, `slug` and `description` values in `templateConfig`
(`scripts/lib/template-config.ts`), then run `pnpm template:sync`. Keep each on its own
`key: "value",` line; the rewrite fails loudly otherwise.

Per-environment values are **not** placeholders: database URLs, Neon Auth URL, Sentry DSN and
the like come from env vars (`.env.example`, validated in `src/env.ts`). Also written by
provisioning (not secret):

- `neon.project.json`: Neon project id, production branch name/id, dev/test branch names. Read by the
  db scripts and the `neon-guard` hook.
- `.mcp.json`: the Neon MCP URL's `projectId=`.
- `.neon` (gitignored): local Neon CLI context, pinned to the `dev` branch.
- `provision.json`: the options the app was provisioned with (owner, visibility, auth, providers,
  region, Vercel team). Re-running `pnpm provision` with different ones is refused.

## 2. Removable auth module

All auth code lives in `src/modules/auth/`. `pnpm auth:remove` (`scripts/remove-auth.ts`)
removes it deterministically and is idempotent. CI runs every check in both variants
(`db-e2e (auth)` and `db-e2e (noauth)`).

### Integration points (the complete list)

| # | File | Role | Without auth |
|---|---|---|---|
| 1 | `src/lib/viewer.ts` | **The** seam features use: `requireViewer()`, `getViewer()` | points to `src/lib/single-owner.ts` (one implicit owner) |
| 2 | `src/lib/auth-ui.ts` | Header account slot (`HeaderAccount`) | no-op component |
| 3 | `src/proxy.ts` | Route protection (private by default, `PUBLIC_ROUTES`) | deleted |
| 4 | `src/app/api/auth/[...path]/route.ts` | Auth API proxy | deleted |
| 5 | `src/app/auth/sign-in/page.tsx` | Sign-in page | deleted |
| 5b | `src/app/api/auth/email-hook/route.ts` | Branded auth email webhook (Resend; inactive without `RESEND_API_KEY` + `EMAIL_FROM`) | deleted |
| 6 | `src/env.ts` | `extends: [authEnv]` | lines removed |
| 7 | `prisma/seed.ts` | Seed users via Neon Auth | single owner |
| 8 | `playwright.config.ts`, `tests/e2e/support/db.ts` | Logged-in setup project, user lookup | no setup project |
| 9 | `tests/e2e/auth/`, `tests/unit/auth-*.test.ts` | Auth tests | deleted |
| 10 | `.env.example`, `CLAUDE.md` | Auth env vars, auth docs | blocks removed |
| 11 | `package.json` | `@neon/auth` dependency | removed |
| 12 | `src/app/styleguide/compare/preview-sheet.tsx` | Sign-in card in the style comparison | block removed |

Files 3–5b are one-line re-exports or wrappers: the code they point to lives in the module.

### Markers `remove-auth` understands

- First line contains `@auth-module: file` → the file is deleted.
- A line **ending** with `// @auth-module`, `# @auth-module`, `{/* @auth-module */}` or `<!-- @auth-module -->` → the line is deleted.
- `// @no-auth: <code>` or `# @no-auth: <code>` → becomes `<code>`.
- Everything from a line containing `@auth-module:start` to `@auth-module:end` → deleted.
- `src/modules/auth/` and `tests/e2e/auth/` → deleted. `@neon/auth` → removed from package.json.

Then: `pnpm install` (updates the lockfile). The script formats rewritten files when Biome is installed.

Rule for new code: features never import `src/modules/auth`; use `@/lib/viewer`. If auth needs
a new integration point, mark it and add it to the table above.

## 3. Theme contract

Restyling an app means editing exactly two files plus, optionally, component variants:

- `src/styles/theme.css`: every design token (colour, radius, border width, density, shadows, motion, heading type), for light and dark.
- `src/config/fonts.ts`: font families (`next/font`).
- `src/components/ui/*`: `cva` variants, to change shape and feel beyond tokens.

Details and rules: `docs/theming.md`. Check the result on `/styleguide` (light and dark);
CI's axe check covers contrast on that page. `/new-app` compares several candidates first on
`/styleguide/compare` (dev only, `STYLE_PREVIEW=1`). The candidates live in
`src/styles/candidates/`, which is empty in every commit.

## 4. Optional features (not in the base)

Analytics, file uploads, rate limiting and background jobs are added by later provisioning
steps, never shipped in the base. Where they go:

- `src/modules/<name>/`: self-contained module (server code, components, `env.ts` with its own `createEnv`).
- Integration points: added to `src/env.ts` `extends`, a seam in `src/lib/` if features need it,
  and env vars in `.env.example`, each marked so the module can be removed the same way as auth.
- Product features (things users do) go in `src/features/<name>/` following `src/features/tasks/`.

## 5. Neon / Vercel / GitHub settings the template expects

| Where | Name | Set by |
|---|---|---|
| GitHub variable | `NEON_PROJECT_ID` | provisioning |
| GitHub secret | `NEON_API_KEY` | provisioning: Neon key scoped to the project (CI branch per run) |
| GitHub env secret (`production`) | `PROD_DATABASE_URL_UNPOOLED` | provisioning (production migrations; the environment only deploys from `main`) |
| GitHub variables | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | provisioning (enables production deploy + preview e2e) |
| GitHub env secret (`production`) | `VERCEL_DEPLOY_HOOK_URL` | provisioning: deploy hook for `main`, called by `migrate-prod.yml` after migrating |
| GitHub secret | `VERCEL_AUTOMATION_BYPASS_SECRET` | provisioning (preview e2e gets past Deployment Protection) |
| GitHub secret | `CLAUDE_CODE_OAUTH_TOKEN` | `/install-github-app` (manual: no CLI can fetch it) |
| GitHub ruleset | `protect-main`: PR required; checks `checks`, `secret scan`, `db-e2e (auth)`, `db-e2e (noauth)` | provisioning |
| Vercel env | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL` (production + per preview) | the Vercel-managed Neon integration |
| Vercel env | `NEON_AUTH_COOKIE_SECRET` (production, preview) | provisioning |
| Vercel env | `NEON_API_KEY` (production, preview; Neon key scoped to the project) | provisioning; used by `pnpm vercel-build` to trust the deployment's URL in Neon Auth |
| Vercel env | `SENTRY_DSN`, `RESEND_API_KEY`, `EMAIL_FROM` (optional) | you, when the app needs them |
| Neon Auth (production branch) | providers; localhost allowed (CI and local tests branch from it) | provisioning |
| Neon Auth trusted domains | the deployment's own URLs, on its own branch (preview: `VERCEL_URL`, `VERCEL_BRANCH_URL`; production: `VERCEL_PROJECT_PRODUCTION_URL`) | `pnpm vercel-build`, every deploy |

If a required check is renamed in `ci.yml`, update `REQUIRED_CHECKS` in
`scripts/lib/provision/github.ts` (a unit test compares them).

## 6. Provisioning (`pnpm provision <slug>`)

`scripts/provision.ts` runs these steps in order. Each step checks real state first, so a re-run
skips finished steps (`↷ already done`) and resumes after a failure. `pnpm provision --help` lists
the options. `--preflight` checks logins, the slug and ownership without changing anything.
`--no-pr` stops before the commit: `/new-app` styles the app in between, then re-runs the same
command.

1. Create the GitHub repo from the template and clone it to `../<slug>`. Cancel the doomed CI run
   on the template's initial commit.
2. Create the `chore/provision` branch, run `pnpm install`, and record the options in
   `provision.json`.
3. Write the app identity to `template.config.ts`, then run `pnpm template:sync`. Remove the
   template-only files: `skills/` (the `/new-app` source), `scripts/link-skill.ts` with its
   `skill:link` script, and `TEMPLATE_SPEC.md`. With auth, write the chosen providers to
   `src/modules/auth/providers.ts`: the sign-in buttons, matching what Neon Auth enables.
4. With `--no-auth`: run `pnpm auth:remove`. With `--theme-dir`: copy the theme files.
5. Create the Vercel project, link the folder, and connect the repo. Turn on GitHub deployment
   events (`gitProviderOptions.createDeployments`), which `e2e-preview.yml` listens for. The
   framework is pinned in `vercel.json`.
6. Create the Neon database through the Vercel-managed integration (`--no-connect`). Then connect
   it through the store connections API, for production + preview, with **a database branch per
   preview deployment**: the CLI's own connect can't set that. Write the project files listed in §1.
7. Set up Neon Auth on the production branch: enabled, providers, localhost. This runs before any
   other branch exists, because branches copy their parent's auth config. Deployed URLs are
   trusted later, by each build.
8. Run `pnpm db:env`: creates the `dev` branch, writes `.env.local`, migrates and seeds. The step
   only counts as done once `prisma migrate status` is clean on `dev`.
9. Set the Vercel `NEON_AUTH_COOKIE_SECRET` and `NEON_API_KEY`. Create the GitHub `production`
   environment, variables, secrets (including the production deploy hook), repo settings and
   ruleset (§5).
10. Run `typecheck`, `lint`, `test` and `build` in the new app.
11. Commit, push, and open the first PR.

**Ownership:** a same-named GitHub repo, Vercel project or Neon resource is adopted (provision) or
deleted (deprovision) only if it's provably this app's:
- the repo was generated from this template;
- the Vercel project is connected to `owner/slug`, or is unlinked while the repo or the local
  `.vercel` link vouches for it;
- the Neon resource is connected to no other project.

Anything else is refused. An existing Neon connection without preview branching is never
disconnected automatically, because that would pull `DATABASE_URL` from a live production: the
script explains the dashboard fix instead.

**Safety nets in `pnpm vercel-build`:**
- A preview fails the build if its `DATABASE_URL` is on a production endpoint (which happens if
  preview branching is ever switched off), before migrating or seeding anything. It compares
  endpoint ids from the API; no production credentials are involved.
- A production build fails while any migration is pending: the deploy hook builds the head of
  `main`, which can be newer than what `migrate-prod.yml` migrated.

Secrets are piped between CLIs through stdin; they never appear in argv or output.

`pnpm deprovision <slug>` undoes it after a typed confirmation, in this order: the scoped Neon
keys, the Neon resource, the Vercel project, and the GitHub repo. It applies the same ownership
rules. Why the Vercel-managed integration:
`docs/decisions/0009-vercel-managed-neon-and-public-repos.md`.
