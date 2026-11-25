/**
 * Vercel build command (vercel.json). Previews: migrate + seed the PR's own Neon branch
 * (injected by the Neon <> Vercel integration), so preview e2e has data and users. A preview whose
 * DATABASE_URL is production's (integration branching switched off) fails the build BEFORE
 * anything touches the database.
 * Production: never migrates here. .github/workflows/migrate-prod.yml applies migrations, then
 * calls the deploy hook. The hook builds the CURRENT head of main, which can be a newer commit
 * whose migrations haven't run yet, so a production build fails while any migration is pending.
 *
 * Both: trust this deployment's URLs in its branch's Neon Auth. Neon Auth rejects sign-ins from
 * an Origin that isn't on the branch's trusted-domain list (INVALID_ORIGIN), each preview branch
 * has its own list, and Vercel's preview hostnames can't be matched by a wildcard
 * (docs/decisions/0009). Uses NEON_API_KEY (project-scoped, set by `pnpm provision`) and the
 * project id in neon.project.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { endpointOf, neonCli, neonJson, readNeonProject } from "./lib/neon";

const run = (args: string[]) => execFileSync("pnpm", args, { stdio: "inherit" });
const env = process.env.VERCEL_ENV;

/** The Neon branch and the https origins this deployment serves, or null outside Vercel. */
export function deploymentOrigins(vars: Record<string, string | undefined>, productionBranch: string) {
  const https = (hosts: (string | undefined)[]) => [...new Set(hosts.filter(Boolean).map((h) => `https://${h}`))];
  if (vars.VERCEL_ENV === "preview" && vars.VERCEL_GIT_COMMIT_REF) {
    return {
      branch: `preview/${vars.VERCEL_GIT_COMMIT_REF}`,
      origins: https([vars.VERCEL_URL, vars.VERCEL_BRANCH_URL]),
    };
  }
  if (vars.VERCEL_ENV === "production") {
    return { branch: productionBranch, origins: https([vars.VERCEL_PROJECT_PRODUCTION_URL]) };
  }
  return null;
}

/** Throws unless the preview's DATABASE_URL is on a different Neon endpoint than production. */
export function assertPreviewDatabase(previewUrl: string | undefined, productionEndpoints: string[]) {
  const preview = endpointOf(previewUrl);
  if (!preview) throw new Error("Preview build: DATABASE_URL is missing or invalid.");
  if (productionEndpoints.length === 0) throw new Error("Preview build: production has no endpoint to compare with.");
  if (productionEndpoints.includes(preview)) {
    throw new Error(
      "Preview build: DATABASE_URL points at the PRODUCTION database. Refusing to migrate, seed or build.\n" +
        "Turn on database branching for previews: Vercel → Storage → the Neon database → Projects → " +
        "this project → 'Create database branch for deployment' → Preview. Then redeploy.",
    );
  }
}

function requireApiKey(what: string) {
  if (!process.env.NEON_API_KEY) throw new Error(`${what}: NEON_API_KEY is not set (run pnpm provision).`);
}

/** Endpoint ids (ep-…) of the production branch, from the API: no credentials involved. */
function productionEndpoints(): string[] {
  const { projectId, productionBranch } = readNeonProject();
  type Endpoints = { endpoints: { id: string; branch_id: string }[] };
  const { endpoints } = JSON.parse(neonCli(["api", `/projects/${projectId}/endpoints`])) as Endpoints;
  return endpoints.filter((e) => e.branch_id === productionBranch.id).map((e) => e.id);
}

function trustDeploymentOrigins() {
  if (!existsSync("src/modules/auth")) return; // auth module removed
  requireApiKey("Neon Auth");
  const { projectId, productionBranch } = readNeonProject();
  const target = deploymentOrigins(process.env, productionBranch.name);
  if (!target) return;
  const base = ["--project-id", projectId, "--branch", target.branch];
  const listed = neonJson<(string | { domain: string })[]>(["neon-auth", "domain", "list", ...base]);
  const trusted = new Set(listed.map((d) => (typeof d === "string" ? d : d.domain)));
  for (const origin of target.origins.filter((o) => !trusted.has(o))) {
    neonCli(["neon-auth", "domain", "add", origin, ...base]);
    console.info(`Neon Auth: trusted ${origin} on ${target.branch}`);
  }
}

const isMain = process.argv[1]?.endsWith("scripts/vercel-build.ts");
if (isMain) {
  if (process.env.VERCEL && !env) {
    throw new Error("VERCEL_ENV is not set: enable 'Automatically expose System Environment Variables'.");
  }
  if (env === "preview") {
    requireApiKey("Preview build");
    assertPreviewDatabase(process.env.DATABASE_URL, productionEndpoints());
  }
  run(["exec", "prisma", "generate"]);
  if (env === "production") {
    // Exits non-zero while a migration is pending: never ship code ahead of its schema.
    console.info("Production: checking every migration has been applied…");
    run(["exec", "prisma", "migrate", "status"]);
  }
  if (env === "preview") {
    console.info("Preview: applying migrations and seeding the preview branch…");
    run(["exec", "prisma", "migrate", "deploy"]);
    run(["exec", "prisma", "db", "seed"]);
  }
  trustDeploymentOrigins();
  run(["exec", "next", "build"]);
}
