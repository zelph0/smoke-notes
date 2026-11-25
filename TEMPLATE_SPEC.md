# AI-First App Template — Spec

Goal: a reusable GitHub template repo plus a `/new-app` Claude Code skill that spins up a new Next.js app fully wired to Neon, Vercel and GitHub. It asks whether to include auth, and gives each app its own visual style.

Build the template **once**, well. Every future app starts from it.

---

## Decisions already made

| Area            | Choice                                          | Notes                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js (App Router) + TypeScript               |                                                                                                                                                                                                                             |
| Styling         | Tailwind + shadcn/ui                            | Theming via CSS variables. Per-app styling changes tokens AND component variants (shape, density, borders, motion), not just colors                                                                                         |
| Database        | Neon Postgres                                   | Branching is the core safety model                                                                                                                                                                                          |
| ORM             | Prisma (7.x or 8.x, VERIFY FIRST)               | Rust-free client; use the Neon adapter for serverless. Prisma 8 changes the query API, and sources disagree on whether it's stable yet. Check prisma.io docs and pick the current stable major before building, then pin it |
| Auth (optional) | Neon managed Better Auth (`@neondatabase/auth`) | Users and sessions live in Postgres and branch with the data. Lives in its own module, so it can be removed cleanly                                                                                                         |
| Hosting         | Vercel                                          | Production + preview deploy per PR                                                                                                                                                                                          |
| Validation      | Zod                                             | Forms, server actions and env vars                                                                                                                                                                                          |
| Env vars        | `@t3-oss/env-nextjs`                            | Build fails on missing vars                                                                                                                                                                                                 |
| Unit tests      | Vitest                                          |                                                                                                                                                                                                                             |
| E2E tests       | Playwright                                      | Runs against preview deploys too                                                                                                                                                                                            |
| Lint/format     | Biome                                           |                                                                                                                                                                                                                             |
| Package manager | pnpm, pinned via `packageManager` + `.nvmrc`    |                                                                                                                                                                                                                             |
| Errors          | Sentry                                          |                                                                                                                                                                                                                             |
| Email           | Resend                                          | Needed for auth verification / reset                                                                                                                                                                                        |

Optional toggles for the questionnaire (NOT in the base): analytics (PostHog / Vercel Analytics), file uploads (Vercel Blob), rate limiting (Upstash), background jobs.

Deliberately excluded: state management library, tRPC/separate API layer, Docker.

---

## Skills & MCP

Official sources only. Read any community skill before installing it.

**User-level (once, on my machine):**

- `frontend-design` (Anthropic): `/plugin install frontend-design@claude-plugins-official`, then `/reload-plugins`. Used for the per-app styling step. Do NOT add a second design skill.
- `skill-creator` (Anthropic): for building and testing the `/new-app` skill.

**Project-level (committed in the template's `.claude/skills` / `.mcp.json`):**

- shadcn skill: `npx skills add shadcn/ui`
- shadcn MCP: `pnpm dlx shadcn@latest mcp init --client claude`
- Neon MCP + skills: `npx neon@latest init` (scope the MCP to dev/preview branches)
- Prisma skills: `npx skills add prisma/skills`
- Vercel plugin: `npx plugins add vercel/vercel-plugin`
- Vercel Labs: `vercel-react-best-practices`, `web-design-guidelines` (vercel-labs/agent-skills), `next-best-practices` (vercel-labs/next-skills)

Use `web-design-guidelines` as a check: the reviewer agent runs it before opening PRs.

---

## Environments

- **Prod:** Vercel production + Neon `main` branch
- **Dev:** local `next dev` against a Neon `dev` branch
- **Preview:** every PR gets a Vercel preview with its own Neon branch (Neon ↔ Vercel integration), deleted when the PR closes
- **No permanent staging server.** Per-PR previews replace it.
- **Backups:** Neon instant restore (Free plan: 6h window; Launch: up to 7 days). Once there are real users, move to Launch and add a nightly GitHub Action that runs `pg_dump` to off-provider storage.

## Database safety rules

- Claude gets read/write MCP access to `dev` and preview branches only
- Production: read-only. Schema changes ship only as Prisma migration files in a PR, applied by CI after merge
- `main` on GitHub is protected: PR + passing CI required

---

## Repo contents (base template)

```
CLAUDE.md                       # short: commands, conventions, gotchas only
.mcp.json                       # Neon (dev-scoped), Vercel
.claude/settings.json           # deny: Read(.env*), force push; ask: push to main
                                # hooks: PostToolUse Biome format; Stop → typecheck + lint
.claude/skills/migrate/         # prisma migrate → test on Neon branch → PR
.claude/agents/reviewer.md      # read-only (Read, Grep, Glob), checks against spec, skips style
.github/workflows/ci.yml        # typecheck, lint, vitest, prisma migrate diff/dry-run, playwright
.github/workflows/claude.yml    # @claude mentions (via /install-github-app)
.github/ISSUE_TEMPLATE/         # includes a "Definition of done" field
.github/pull_request_template.md# asks for evidence: commands run, screenshots
renovate.json (or dependabot)
docs/decisions/                 # short decision records (the "why" Claude can't see)
.env.example
prisma/schema.prisma + prisma/seed.ts   # `pnpm db:seed` gives realistic data
src/env.ts                      # t3-env + zod
app/error.tsx, not-found.tsx, loading.tsx, api/health/route.ts
security headers + metadata/OG defaults
```

### Reference feature (most important for AI-first)

One small, complete feature (e.g. Notes or Tasks) built exactly the way every feature should be built:

- Prisma model + migration
- Server action with Zod validation
- Page with loading, empty and error states
- Vitest test + Playwright test

Claude copies existing patterns more reliably than it follows written rules.

---

## `/new-app` skill (user-level: `~/.claude/skills/new-app/`)

`disable-model-invocation: true`, so it runs only when typed.

Questionnaire (multiple choice where possible):

1. App name / slug
2. Include auth? If yes: which providers (email/OTP, Google, GitHub)
3. Styling: a short description of the vibe, an optional colour palette (names or hex), plus optional reference URLs/screenshots → Claude generates several directions to choose from (see "Styling step" below)
4. Optional features (toggles listed above)
5. Custom domain (optional)

### Styling step: pick from generated options

Instead of one guess, Claude generates **3–4 distinct directions** and the user picks.

- **Each direction is a complete style**, following the theme contract (`docs/theming.md`):
  - tokens in `theme.css` (palette for light and dark, radius, border width, density, shadows, motion, heading type);
  - fonts in `fonts.ts`;
  - component variant changes (e.g. pill buttons, underline inputs).

  Directions must differ in more than colour.
- **Use the palette if one is given.** Directions may vary how it's applied (which colour is primary, accent, neutral tint), but don't replace it.
- **Preview on real components.** Show a local preview page that renders the app's real UI with each direction side by side, or with a switcher, plus a light/dark toggle:
  - the Tasks list with items in every state, the task form with a validation error, a dialog;
  - buttons, inputs and badges, the sign-in card;
  - the `/styleguide` components.

  Candidates are scoped (e.g. `[data-theme-preview="b"]`) so they render together without touching the real theme.
- **Contrast is checked before showing.** Run the axe contrast check on every direction, in light and dark. Fix or drop failing ones before the user sees them.
- **The user chooses:**
  - one direction;
  - a mix ("A's colours with C's shapes");
  - or another round with feedback.

  Claude then writes only the chosen style into `theme.css`, `fonts.ts` and the variants, and removes the preview candidates.
- **Run the normal checks after applying:** `/styleguide` in light and dark, and `pnpm test:e2e` (the axe checks).
- **The same flow can restyle the template's own default look.**

**Never ask for secrets.** The user logs into the CLIs once (`gh auth login`, `neonctl auth`, `vercel login`, `claude setup-token`). The provisioning script pulls keys from those CLIs and writes them straight into Vercel env vars, GitHub secrets and `.env.local`.

## Provisioning script (`scripts/provision.ts`, deterministic)

1. `gh repo create <name> --template <template-repo> --private --clone`
2. Create a Neon project + `dev` branch; write connection strings to `.env.local`
3. `vercel link`; set env vars for production/preview/development
4. Set GitHub secrets
5. Enable Neon ↔ Vercel preview branching
6. Apply or remove the auth module; apply theme tokens
7. `pnpm install && pnpm build && pnpm test`
8. Open the first PR; print the repo, Vercel and Neon URLs

The script must be idempotent and safe to re-run.

---

## Contracts the template must expose (for steps 2–3)

Step 1 must build these so the provisioning script and `/new-app` can customize the template safely, without rewriting it:

- **Placeholders:** app name, slug and description live in ONE place (e.g. `template.config.ts`). Every other file (package.json name, metadata, README title) reads from it or uses a clearly marked token. Document the list in `docs/template-contract.md`.
- **Removable auth module:** all auth code lives under one folder, plus a documented, short list of integration points (layout provider, proxy/middleware, protected-route helper, env vars). Add a `scripts/remove-auth.ts` that removes it cleanly; CI must pass both with and without auth (run the build in both variants).
- **Theme contract:** all design tokens (colors, radius, fonts, shadows, motion) live in one file (e.g. `src/styles/theme.css`) plus a `src/config/fonts.ts`. Components use tokens only, never hard-coded colors. `docs/theming.md` explains what `/new-app` changes to restyle an app, including component variants, not just colors.
- **Optional features:** each optional toggle (analytics, uploads, rate limiting, etc.) is added by a later step and is NOT in the base template. The base only needs a documented pattern for where feature modules go.

## Testing & databases

- **Local dev and tests:** use a Neon `dev` branch for `pnpm dev`. Tests run against a separate disposable Neon branch (created/reset by a script), never `dev` or `main`.
- **CI:** each CI run creates a temporary Neon branch, runs `prisma migrate deploy` + seed, runs the tests, then deletes the branch. The Neon API key is a GitHub secret.
- **E2E auth:** Playwright uses a seeded test user and a saved, logged-in session state, so tests don't sign in through the UI on every spec.
- **Accessibility:** Playwright runs axe checks on key pages; CI fails on serious violations.
- **Where checks run:**
  - PostToolUse hook: format the edited file (fast)
  - Stop hook: `typecheck` + `lint` only (under ~30s)
  - CI: everything, including unit tests, e2e tests, migration check, and the build with and without auth

## Migrations in production

- Developers and Claude create migrations with `prisma migrate dev` against a Neon branch, and commit them in the PR.
- Preview deploys apply migrations to their own preview branch.
- Production: a GitHub Action runs `prisma migrate deploy` against `main` after merge, BEFORE the production deploy is promoted. Never apply migrations from a local machine to production.
- The `migrate` skill documents this whole flow, including how to roll back (Neon instant restore + a down migration).

## Code conventions the reference feature must demonstrate

- **Authorization, not just authentication:** every query for user-owned data is scoped through a single helper (e.g. `getCurrentUserOrThrow()` plus an owner filter). The reference feature shows it, and a test proves user A can't read or modify user B's data.
- **Server actions** return a typed result (`{ ok: true, data } | { ok: false, error }`) and validate input with Zod. Never throw raw strings to the client.
- **Errors:** expected errors are returned as results; unexpected ones go to an error boundary and get logged (Sentry when configured).
- **Data fetching** happens in server components by default; client components only where interactivity needs them.

## External services in step 1

- **Sentry, Resend:** wire up the code paths, but make them inactive when their env vars are missing (no-op in dev). Don't require accounts to finish step 1.
- **Vercel:** not needed for step 1.

## Git & workflow conventions

- Branch names: `feat/…`, `fix/…`, `chore/…`. Conventional Commits messages.
- Commit at each working milestone during long builds (not one giant commit at the end).
- Feature specs live in `docs/specs/<feature>.md` (written by "interview me, then write the spec" sessions). The reviewer agent checks work against them.
- `.worktreeinclude` lists `.env.local`, so parallel worktree sessions boot.
- Secret scanning: enable GitHub push protection, and add a gitleaks check in CI.

## Step 1 is done when

- [ ] `pnpm dev` runs; sign up, sign in, create/edit/delete a task, sign out all work
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` pass, with output shown
- [ ] The build passes after `scripts/remove-auth.ts` runs (on a throwaway copy)
- [ ] The authorization test passes (user A can't access user B's tasks)
- [ ] The Stop hook blocks finishing on a deliberate type error (demonstrate it once)
- [ ] CI workflow is valid (act/dry run or first push), including the Neon branch-per-run setup
- [ ] `docs/template-contract.md`, `docs/theming.md` and CLAUDE.md exist; CLAUDE.md is under ~100 lines
- [ ] Work is committed in logical milestones

## Open decisions (ask before building)

- Should repos live under a personal GitHub account or an org?
- Default OAuth providers alongside email?

## Build order

1. Template repo: base app + harness files + reference feature, with CI green
2. Provisioning script, tested by creating a throwaway app, then deleting it
3. `/new-app` skill wrapping the script + questionnaire + styling step
4. End-to-end run: create a real app with auth and a custom style; verify login on a preview deploy with Playwright
