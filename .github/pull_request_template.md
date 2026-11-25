## What & why

<!-- One or two sentences. Link the issue (Closes #…) and the spec in docs/specs/ if there is one. -->

## Definition of done

<!-- Copy the checklist from the issue and tick what this PR delivers. -->

## Evidence

<!-- Show it works. Paste real output, not "tests pass". -->

- Commands run:
  ```
  pnpm typecheck && pnpm lint && pnpm test
  pnpm db:test && pnpm test:integration && pnpm test:e2e
  ```
- Screenshots / recording (UI changes, light + dark):

## Database

- [ ] No schema change
- [ ] Schema change: migration SQL below, follows expand/contract, tested with `pnpm db:test`

<!-- paste migration.sql here if any -->

## Checklist

- [ ] Reviewer agent run (`reviewer`), findings addressed
- [ ] Follows the Tasks reference feature patterns (viewer scoping, ActionResult, states)
- [ ] No hard-coded colours/sizes (theme tokens only)
