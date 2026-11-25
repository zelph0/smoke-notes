# App Template <!-- template:name -->

A starting point for new web apps. It comes with a database, sign-in, a finished example
feature (a to-do list called **Tasks**), tests, and safety rails so Claude Code can build on
it without breaking things. Every new app starts as a copy of this repo.

**Built with:** Next.js · Neon Postgres · Prisma · Neon Auth · Tailwind + shadcn/ui · Vitest ·
Playwright · Biome · pnpm. The reasons behind each choice are in [`docs/decisions/`](docs/decisions/).

## Where things stand

| Build step | What it gives you | Status |
|---|---|---|
| 1. This template | The base app, tests, CI and Claude Code setup | ✅ Done |
| 2. Provisioning script | One command that creates a new app: GitHub repo, Neon database, Vercel project, secrets | ✅ Built (`pnpm provision`) |
| 3. `/new-app` skill | Claude asks you a few questions (name, sign-in, style), shows style options, runs the script | ✅ Built (`/new-app`) |

So today you can **work on the template** and **create a new app** by typing `/new-app` in Claude
Code (see below).

---

## How it works, in plain terms

**Three places hold your app:**

- **GitHub** holds the code. Nobody, including Claude and you, can push straight to `main`.
  Every change goes through a pull request (PR), and the PR can only merge when all checks pass.
- **Neon** holds the database. A Neon database can be copied instantly into a *branch*,
  like a git branch but for data. Each place gets its own copy, so testing never touches real data:

  | Neon branch | Used by | Notes |
  |---|---|---|
  | `main` | The live app (production) | Claude can only read it. Changes arrive through CI, never from a laptop |
  | `dev` | `pnpm dev` on your computer | Your playground. Fine to break |
  | `test` | Local test runs | Wiped and rebuilt by `pnpm db:test` |
  | `ci/…` | Each CI run | Created at the start of the run, deleted at the end |
  | `preview/…` | Each PR's preview site | Created and deleted automatically (once Vercel is connected) |

- **Vercel** hosts the live site and a preview site for every PR. The template itself isn't
  deployed; each app you create gets its own Vercel project.

**The life of a change:**

1. You (or Claude) work on a branch named `feat/…`, `fix/…` or `chore/…`, running the app
   against the `dev` database.
2. You open a PR. CI then builds a fresh database branch, applies the database changes, loads
   sample data, and runs every test twice: once with sign-in and once with sign-in removed.
3. When the checks are green, you merge. A GitHub Action applies any database changes to
   production *first*, then deploys the site.

**How Claude is kept safe** (all of it is in [`.claude/`](.claude/) and checked into the repo):

- It can't read your `.env` files (where passwords live), force-push, or push to `main`
  without asking.
- It can't change the production database: a guard blocks it, even through the Neon tools.
- Every edit it makes is auto-formatted, and it can't finish a task while the code has type
  or lint errors.
- A read-only `reviewer` agent checks work against the spec before a PR.

---

## Create a new app

One-time logins (the script never asks for passwords or keys; it reads them from these CLIs):

```bash
gh auth login
pnpm exec neon login
pnpm exec vercel login
```

Also once: give the [Vercel GitHub app](https://github.com/apps/vercel/installations/new) access to
"All repositories", so new repos can be connected without a browser. Then make `/new-app` available
in every Claude Code session (run it in this repo):

```bash
pnpm skill:link
```

Then type **`/new-app`** in Claude Code, from any folder. Claude asks for:
- a name and a sentence about the app;
- the sign-in you want;
- the look you're after (a vibe, optional colours, optional example sites).

It creates the app, then shows 3–4 style options side by side on the app's real screens. You pick
one (or a mix, or ask for another round), and it opens the app's first PR with that style.

Under the hood it runs `pnpm provision`, which you can also run yourself:

```bash
pnpm provision my-app --name "My App" --description "One sentence about it."
```

It creates `github.com/<you>/my-app` (public) and clones it next to this folder (`../my-app`). It also sets up:

- a Vercel project with a preview for every PR;
- a Neon database: production, a `dev` branch for your computer, and a branch per preview;
- sign-in (email code + Google);
- every GitHub secret CI needs;
- protection for `main`.

It ends by opening the app's first PR. Merge it when the checks are green: that sets up the
production database and deploys the site. Useful options (`pnpm provision --help` for all):

| Option | What it does |
|---|---|
| `--no-auth` | No sign-in at all |
| `--providers google,github` | Social sign-in next to email codes (`none` for email only) |
| `--private` | Private repo (GitHub only enforces the `main` protection on paid plans) |
| `--region fra1` | Database region (default `iad1`, US East) |

If it stops halfway, fix what it says and run the **same command** again: it skips what's done.
(Changing options like `--no-auth` on a re-run is refused; the app remembers them in `provision.json`.)
Afterwards, open the app in Claude Code and run `/install-github-app` once (for `@claude` in PRs).

To delete an app completely (repo, Vercel project, database): `pnpm deprovision my-app`. It shows
what it will delete and asks you to type the name first. This can't be undone.

---

## Set up a new computer (once)

1. **Node 24**. With [nvm](https://github.com/nvm-sh/nvm): `nvm install` inside the repo reads `.nvmrc`.
2. **pnpm 12**:

   ```bash
   npm install -g pnpm@12.23.0
   ```

3. **GitHub CLI**, then log in:

   ```bash
   gh auth login
   ```

4. **Claude Code**, plus the two user-level plugins the template expects:
   `/plugin install frontend-design@claude-plugins-official` and the `skill-creator` plugin.
   Everything else Claude needs (skills, hooks, agents, MCP servers) comes with the repo.

## Work on this template on a new computer

```bash
gh repo clone zelph0/app-template
cd app-template
pnpm install
pnpm exec neon login       # opens your browser to log in to Neon
pnpm db:env                # writes .env.local, pointing at the "dev" database
pnpm dev                   # http://localhost:3000
```

`pnpm db:env` asks Neon for the `dev` database's address and writes `.env.local` for you;
you never copy passwords by hand. Run it again any time `.env.local` is lost or broken.
It keeps anything you added yourself.

Sign in at <http://localhost:3000> with an email code or Google. Your account starts empty.
The sample tasks belong to a demo user; to get them on your own account, add
`SEED_USER_EMAIL="you@example.com"` to `.env.local` and run `pnpm db:seed`.
(This deletes that account's tasks on `dev` first.)

**In Claude Code**, open the repo and run `/mcp` once to log in to the Neon (and later Vercel)
tools. Claude reads [`CLAUDE.md`](CLAUDE.md) automatically.

**To run all the tests** on a new computer, first install Playwright's browser once:

```bash
pnpm exec playwright install chromium
```

Then:

```bash
pnpm db:test && pnpm test && pnpm test:integration && pnpm test:e2e
```

---

## Day-to-day

- **Building a feature:** ask Claude. It writes a short spec in `docs/specs/`, then copies the
  shape of `src/features/tasks/`: validation, database access scoped to the signed-in user,
  the page with loading, empty and error states, and tests.
- **Changing the database:** Claude uses the `migrate` skill. It writes a migration file,
  tests it on a throwaway database branch, and ships it in a PR. It covers rolling back too.
- **Changing the look:** colours, fonts, corner radius, spacing and motion live in
  `src/styles/theme.css` and `src/config/fonts.ts`. Check the result at
  <http://localhost:3000/styleguide> in light and dark mode. Details: [`docs/theming.md`](docs/theming.md).
- **Before a PR:** ask Claude to run the `reviewer` agent, then open the PR. The template asks
  for the commands you ran and screenshots.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app on <http://localhost:3000> against the `dev` database |
| `pnpm db:env` | Write `.env.local` for the `dev` database (new computer, lost file) |
| `pnpm typecheck` / `pnpm lint` | Check types / check formatting and lint rules (`lint:fix` fixes them) |
| `pnpm test` | Unit tests (no database needed) |
| `pnpm db:test` | Rebuild the `test` database: apply migrations, load sample data |
| `pnpm test:integration` | Tests that talk to the `test` database |
| `pnpm test:e2e` | Browser tests (Playwright): builds the app and clicks through it |
| `pnpm db:migrate --name <change>` | Create a database migration on `dev` (use the `migrate` skill) |
| `pnpm db:seed` | Load sample data into `dev` (safe to repeat) |
| `pnpm db:studio` | Browse the `dev` database in your browser |
| `pnpm auth:remove` | Remove sign-in entirely (for apps that don't need accounts) |
| `pnpm provision <slug>` | Create a new app from this template (see above) |
| `pnpm deprovision <slug>` | Delete an app's repo, Vercel project and database (asks first) |
| `pnpm skill:link` | Make `/new-app` available in every Claude Code session on this computer |
| `pnpm style:check` / `pnpm style:reset` | Check / remove style options on `/styleguide/compare` (see `docs/theming.md`) |

### Where things live

| Path | What's there |
|---|---|
| `src/features/tasks/` | **The example feature.** New features copy its shape |
| `src/modules/auth/` | All sign-in code, in one removable folder |
| `src/styles/theme.css`, `src/config/fonts.ts` | The app's look |
| `template.config.ts` | App name, short name and description (the only place they're set) |
| `prisma/` | Database schema, migrations and sample data |
| `tests/` | `unit/`, `integration/` and `e2e/` tests |
| `.claude/` | Claude Code settings, safety hooks, skills and the reviewer agent |
| `.github/workflows/` | CI and deploy automation |
| `docs/template-contract.md` | What the provisioning script may change, and how |
| `docs/decisions/` | Why things are the way they are |

---

## When something goes wrong

| Symptom | Fix |
|---|---|
| The app says an environment variable is missing | `pnpm db:env` |
| Integration or e2e tests fail on the database | `pnpm db:test` to rebuild the test database |
| `Executable doesn't exist` from Playwright | `pnpm exec playwright install chromium` |
| pnpm refuses a package that is "less than a day old" | Intended (it guards against bad releases). Use the previous version |
| Prisma suggests upgrading to 8 | Ignore it. Prisma is pinned to 7 on purpose ([decision 0001](docs/decisions/0001-prisma-7-pin.md)) |
| A PR can't merge | A check failed. Open the PR's **Checks** tab, or ask Claude to fix CI |
| Sample tasks don't show after signing in | They belong to the demo user. See `SEED_USER_EMAIL` above |
