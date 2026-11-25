# 0007: No staging server: a preview + database branch per PR

Date: 2026-11-24 · Status: accepted

**Decision.**
- Each PR gets a Vercel preview with its own Neon branch, migrated and seeded by `pnpm vercel-build`, and Playwright runs against it (`e2e-preview.yml`).
- Production deploys only from `migrate-prod.yml` (git-triggered production deploys are off in `vercel.json`), so migrations always land first.

**Consequences.** There is no long-lived staging data. Reproduce production issues on a Neon branch of `main`.
