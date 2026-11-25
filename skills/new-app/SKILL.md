---
name: new-app
description: Create a new web app from the app-template, fully wired (GitHub repo, Vercel project, Neon database, auth, CI secrets) and with its own visual style picked from generated options. Runs only when the user types /new-app.
disable-model-invocation: true
argument-hint: "[app name or one-line idea]"
---

# /new-app: a new app from the template, styled and ready for its first PR

You are creating a real app for the user. It ends as a GitHub repo with an open PR, a Vercel
project with per-PR previews, and a Neon database (production, `dev` and a branch per preview).
`pnpm provision` in the template does the wiring; your job is the conversation around it: the
questions, the style, and checking the result.

Work in this order. Each step says why it matters; keep to it even when a step feels skippable.

## 0. Find the template and make sure it's current

This skill lives in the template repo (`skills/new-app/`) and is symlinked into
`~/.claude/skills/new-app`, so the template is two folders above this file's real path:

```bash
T="$(cd "$(dirname "$(readlink -f ~/.claude/skills/new-app/SKILL.md)")/../.." && pwd)"
git -C "$T" status --porcelain        # must print nothing
git -C "$T" branch --show-current     # must be main
git -C "$T" pull --ff-only && pnpm -C "$T" install --frozen-lockfile
```

New apps are copies of the template's GitHub `main`, and provisioning runs the scripts from this
checkout, so both must match. If the checkout is dirty or not on `main`, stop and tell the user;
don't stash or switch branches for them.

## 1. Ask the questions

Ask in plain chat first, because these are free text (use the command's argument if given):

- **App name** and **one sentence** describing it. Derive a slug (lowercase letters, digits,
  dashes, ≤ 60 chars) and show it so the user can change it.
- **Style**: the vibe in a few words, an optional colour palette (names or hex), optional
  reference URLs or screenshots. "No preference" is fine: you'll propose directions anyway.

Then one AskUserQuestion with the multiple-choice ones:

- **Sign-in**: "Email code + Google" (recommended) · "Email code + Google + GitHub" ·
  "Email code only" · "No sign-in" (single owner, no accounts). Maps to `--providers google`,
  `--providers google,github`, `--providers none`, `--no-auth`. The sign-in page shows exactly
  the chosen buttons.
- **Repo visibility**: "Public" (recommended: GitHub only enforces the `main` protection on
  private repos on paid plans) · "Private" (`--private`).

Optional features (analytics, uploads, rate limiting, background jobs) and custom domains aren't
available yet. If the user asks, say so; don't improvise them.

Then check everything before creating anything:

```bash
pnpm -s -C "$T" provision <slug> <flags> --preflight
```

It verifies the `gh`, `neon` and `vercel` logins, that the slug is free (or belongs to an earlier
run of this app), and that `../<slug>` next to the template is free or already this app's clone.
If a login is missing, give the user the exact command it prints (`gh auth login`,
`pnpm exec neon login`, `pnpm exec vercel login`) and wait. **Never ask for a password, token or
key**: every secret moves between the CLIs without passing through you or the user.

## 2. Provision, without the PR yet

```bash
pnpm -s -C "$T" provision <slug> --name "<name>" --description "<sentence>" <flags> --no-pr --json
```

Run it in the background and **wait for it to exit** before step 3: it ends by building the new
app, and nothing else may run `next` in that folder meanwhile. It takes a few minutes (repo,
Vercel, Neon, dev database, secrets, then typecheck/lint/test/build). Progress goes to stderr; the
last stdout line is one JSON object with `dir` (the new app's folder), `repo`, `vercel` and `neon`.

If it stops, read the error, fix the cause, and run **the same command again**: every step checks
real state first, so finished steps are skipped. Keep the flags identical between runs; the app
records them in `provision.json` and refuses changes.

`--no-pr` leaves the app on its `chore/provision` branch with everything uncommitted, so the
chosen style lands in the same first PR.

## 3. Style the app: generate options, preview them, let the user choose

Read **"Comparing styles" in `<dir>/docs/theming.md`** now: it has the exact candidate file
formats and how to apply one. Use the `frontend-design` skill for the aesthetic direction (it's
installed at user level for this step). All of this happens in the new app's folder (`dir`).

1. **Generate 3–4 directions** as style candidates in `src/styles/candidates/`. Each is a complete
   style: light and dark colour tokens, radius, border width, density, shadows, motion, heading
   type, fonts, and component variant changes. They must differ in more than colour: a direction
   that's "the same but blue" wastes one of the user's few choices. If the user gave a palette,
   every direction uses it; vary how (which colour is primary, accent, neutral tint), never replace it.
2. **Check contrast before showing anything.**
   - Check port 3200 is free (`lsof -i :3200`); if not, find out what holds it rather than test
     the wrong server.
   - Start the preview server from the app folder in the background:
     `cd <dir> && STYLE_PREVIEW=1 pnpm dev --port 3200` (the page 404s without `STYLE_PREVIEW=1`).
     Wait for its "Ready" line.
   - Once per machine, `pnpm exec playwright install chromium` in the app folder.
   - Then, from the app folder: `STYLE_BASE_URL=http://localhost:3200 pnpm style:check`. It runs
     axe on every candidate in light and dark, with and without a dialog open, against that
     server (only one `next dev` can run per folder, so always pass the URL).
   - Fix failing tokens and re-run, or drop a direction that can't be fixed. The user should only
     ever see accessible options. The server hot-reloads CSS and list edits; restart it after
     changing fonts.
3. **Show them.** Open `http://localhost:3200/styleguide/compare` in the browser pane with
   preview_start and that `url`. That only opens a tab. Don't use a named launch configuration:
   those run from the session's own folder, not the new app. Each candidate renders the app's
   real components:
   - the Tasks list in every state;
   - the task form with a validation error;
   - a dialog;
   - buttons, inputs and badges;
   - the sign-in card.

   Take a screenshot in light and one in dark (theme switch in the header) so the user sees both,
   and describe each direction in a line.
4. **Ask** with AskUserQuestion: one option per direction, plus "Mix them" and "Another round".
   For a mix ("A's colours with C's shapes") or another round, write new candidates from the
   feedback and repeat 2–3.
5. **Apply only the chosen style** ("Applying the chosen candidate" in `docs/theming.md`):
   - tokens into `src/styles/theme.css`;
   - fonts into `src/config/fonts.ts`;
   - variant changes as `cva` edits in `src/components/ui/*`.

   Then run `pnpm style:reset` to remove every candidate. Candidates must never be committed;
   a unit test fails CI if they are.
6. **Verify.**
   - If `fonts.ts` changed, restart the preview server so it loads the new fonts.
   - Screenshot `/styleguide` in light and dark, and show the user.
   - Then stop that server (the background `pnpm dev`): the next commands build the app, which
     can't happen while `next dev` runs in the same folder.
   - Run `pnpm typecheck && pnpm lint`, then `pnpm db:test && pnpm test:e2e` for the axe checks
     on the real pages and an open dialog.

## 4. Open the PR

Run the step 2 command again, **without** `--no-pr` and with the same other flags. Everything
already done is skipped; it re-runs typecheck/lint/test/build with the new style, commits, pushes
and opens the app's first PR.

## 5. Report

Tell the user, in plain words:

- The app folder, repo, PR, Vercel and Neon links (from the JSON).
- What happens next: CI runs on the PR and a preview deploys with its own database; merging the
  PR migrates production and deploys it.
- What's left by hand:
  - Run `/install-github-app` in Claude Code inside the app, for `@claude` on PRs (no CLI can
    fetch that token).
  - With Google or GitHub sign-in: give production its own OAuth client before real users. The
    shared one is for dev and previews.
- To throw the app away: `pnpm -C "$T" deprovision <slug>` (asks for confirmation; permanent).

Don't merge the PR yourself; that's the user's call.
