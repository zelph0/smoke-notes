# 0009: Provisioning uses the Vercel-managed Neon integration and public repos

Date: 2026-11-24 · Status: accepted

**Context.** `pnpm provision` (build step 2) must create an app end to end without a browser or
pasted secrets, and every PR needs a preview with its own Neon branch. Neon offers two Vercel
integrations (checked against neon.com docs, 2026-11-18):

- **Neon-managed:** keeps the project in our own Neon org, but connecting it is browser-only.
- **Vercel-managed:** `vercel integration add neon` creates the project from the CLI, in the
  "Vercel: <team>" Neon org.

GitHub's free plans don't enforce rulesets or branch protection on private repos.

**Decision.**
- Use the **Vercel-managed** integration:
  `vercel integration add neon --name <slug> --meta region=… --meta auth=… --no-connect`, then a
  `POST /v1/storage/stores/<store>/connections` with `deployments.actions: [{ slug: "Neon",
  environments: ["preview"] }]`.
  - That is the dashboard's "Create database branch for deployment: Preview". The CLI's connect
    leaves it off, and then previews silently receive **production's** `DATABASE_URL`.
  - The body shape was read back from a dashboard-made connection. It is undocumented, so
    provisioning verifies it after connecting, and `vercel-build` refuses to run a preview against
    production.
  - It injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_AUTH_BASE_URL` into production and
    into each preview, which gets its own `preview/<git-branch>` database.
  - It is never connected to `development`, because that would point local dev at production. Local
    dev keeps using the `dev` branch (`pnpm db:env`).
- Pin the Vercel CLI as a devDependency (`pnpm exec vercel`), like `neon`. The provisioning
  scripts use that pinned version.
- New app repos default to **public** under the gh user, so `protect-main` is enforced for free.
  `--private` exists for paid plans.
- CI credentials are least-privilege:
  - a Neon API key scoped to the one project;
  - no Vercel token: production deploys go through a deploy hook for `main`
    (`VERCEL_DEPLOY_HOOK_URL`, a `production` environment secret). CLI sessions from "Sign in with
    Vercel" can't create tokens, and a hook can only build `main`;
  - the production DB URL as a secret of the `production` environment, which only `main` can use.
- Neon Auth trusted domains are set **at build time**, not at provisioning. Neon Auth rejects
  sign-ins whose `Origin` isn't trusted (`INVALID_ORIGIN`), and each preview branch has its own copy
  of the list.
  - Neon wildcards must be a whole leftmost label. So `https://*-<team>.vercel.app` is rejected, and
    `https://*.vercel.app` would trust every Vercel site.
  - Instead, `pnpm vercel-build` adds the deployment's exact URLs to its own branch:
    `VERCEL_URL` + `VERCEL_BRANCH_URL` on `preview/<branch>`, `VERCEL_PROJECT_PRODUCTION_URL` on
    production, which covers custom domains too.
  - It uses a second project-scoped Neon key, stored as `NEON_API_KEY` in Vercel (production +
    preview, sensitive). Localhost stays allowed on production because CI and local tests branch
    from it.

**Consequences.**
- Neon plan and compute changes for an app happen in the Vercel dashboard. The project can't be
  moved out of the Vercel org later.
  - Your normal `neon` login still works on it: the org lists under `neon orgs list`.
- Preview branches are deleted when their Vercel deployment is deleted, not on merge.
  `neon-cleanup.yml` deletes them when the PR closes.
- `CLAUDE_CODE_OAUTH_TOKEN` can't be fetched by any CLI. Each app still needs `/install-github-app`
  once.
- Preview builds hold a Neon key that can change any branch of the app's project. Only people who
  can push branches to the repo trigger those builds. Vercel doesn't expose env vars to fork PRs
  without approval.
- Deleting an app is `pnpm deprovision <slug>`, behind a typed confirmation.
