# 0010: `/new-app` lives in the template; styles are compared before the first PR

Date: 2026-11-24 · Status: accepted

**Context.** Build step 3 wraps `pnpm provision` in a Claude Code skill: a few questions, then a
style chosen from generated options. The spec puts the skill at user level so it runs from any
folder, and asks for the options to be previewed on the app's real components, side by side,
without touching the real theme.

**Decision.**
- **The skill source lives in the template.** It's in `skills/new-app/`, versioned and reviewed
  like code. `pnpm skill:link` symlinks it into `~/.claude/skills/new-app`.
  - The skill finds the template through that link and requires a clean, pulled `main`. New apps
    are copies of GitHub `main`, so the checkout running the scripts must match it.
  - Provisioning removes `skills/` (and `TEMPLATE_SPEC.md`) from new apps.
  - `disable-model-invocation: true`: it only runs when typed, because it creates real resources.
- **Styling happens before the first PR.** The skill runs `pnpm provision … --no-pr`, styles the
  new app on its seeded `dev` database, then re-runs the same command, which opens one PR with
  the theme. Idempotency makes the second run cheap.
- **Candidates are scoped CSS.** `/styleguide/compare` renders every candidate together:
  - each is scoped with `[data-theme-preview]`, with its own `next/font` classes;
  - variant ideas are previewed as scoped rules on `data-slot`s, then applied as `cva` edits.
- **The compare page is dev-only.** It 404s unless `STYLE_PREVIEW=1`, and `src/styles/candidates/`
  is empty in every commit (a unit test enforces it). It ships with the template so any app can
  be restyled the same way later.
- **Contrast is checked before anyone sees a candidate.** `pnpm style:check` runs axe per
  candidate in light and dark against `next dev`: no build, no test database.
- **The candidate formats live in `docs/theming.md`**, which every app has, so an app can be
  restyled later the same way. The skill points there instead of carrying its own copy.
- **Sign-in buttons follow the providers.** `src/modules/auth/providers.ts` lists them;
  provisioning writes it from `--providers`, so the page matches what Neon Auth enables.
- **Not in step 3:** optional feature modules and custom domains. Each comes later as a module
  plus a provision flag.

**Consequences.**
- Changes to the skill reach new apps only after they're merged to the template's `main` and
  pulled locally.
- Candidate fonts load only on the compare page; applying a style still means editing
  `src/config/fonts.ts`.
- `TaskForm` takes an `initialState` and `DialogContent` takes a portal `container`, both so the
  compare page can show a validation error and keep a dialog inside its scope.
- The comparison covers the app's components but not the token swatches and type samples of
  `/styleguide`; those are checked on `/styleguide` after a style is applied.
- Checking dialogs (in `style:check` and the e2e axe tests) found that the default dark red failed
  contrast on dialog footers. It's now lighter (`oklch(0.74 0.17 22)`).
