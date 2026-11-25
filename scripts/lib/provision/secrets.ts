/**
 * GitHub Actions variables and secrets (docs/template-contract.md §5). Each secret is created only
 * when missing, read straight from the CLI that owns it and piped into `gh secret set` via stdin.
 * Nothing is printed and nothing is asked of the user.
 */
import { ACTIONS_CREDENTIAL_NAME, BUILDS_CREDENTIAL_NAME, type Context, type Step } from "./context";
import { listSecrets, listVariables, setSecret, setVariable } from "./github";
import { productionDirectUrl, withFreshNeonApiKey } from "./neon";
import { ensureBypassSecret, ensureDeployHook, envTargets } from "./vercel";

function wantedVariables(ctx: Context): Record<string, string> {
  return {
    NEON_PROJECT_ID: ctx.facts.neonProjectId ?? "",
    VERCEL_ORG_ID: ctx.facts.vercelOrgId ?? "",
    VERCEL_PROJECT_ID: ctx.facts.vercelProjectId ?? "",
  };
}

export const variablesStep: Step = {
  id: "github-variables",
  title: "GitHub variables (NEON_PROJECT_ID, VERCEL_ORG_ID, VERCEL_PROJECT_ID)",
  isDone(ctx) {
    const current = listVariables(ctx);
    return Object.entries(wantedVariables(ctx)).every(([name, value]) => current.get(name) === value);
  },
  run(ctx) {
    const current = listVariables(ctx);
    for (const [name, value] of Object.entries(wantedVariables(ctx))) {
      if (!value) throw new Error(`Missing a value for ${name}; an earlier step didn't record it.`);
      if (current.get(name) !== value) setVariable(ctx, name, value);
    }
  },
};

type SecretSpec = {
  name: string;
  environment?: string;
  /** Produces the value and passes it to `store` (which runs `gh secret set`). */
  provide(ctx: Context, store: (value: string) => void): void;
};

const plain =
  (value: (ctx: Context) => string): SecretSpec["provide"] =>
  (ctx, store) =>
    store(value(ctx));

export const SECRETS: SecretSpec[] = [
  {
    name: "NEON_API_KEY",
    provide: (ctx, store) => withFreshNeonApiKey(ctx, ACTIONS_CREDENTIAL_NAME(ctx.opts.slug), store),
  },
  { name: "VERCEL_DEPLOY_HOOK_URL", environment: "production", provide: plain(ensureDeployHook) },
  { name: "VERCEL_AUTOMATION_BYPASS_SECRET", provide: plain(ensureBypassSecret) },
  { name: "PROD_DATABASE_URL_UNPOOLED", environment: "production", provide: plain(productionDirectUrl) },
];

function missingSecrets(ctx: Context): SecretSpec[] {
  const repo = listSecrets(ctx);
  const production = listSecrets(ctx, "production");
  return SECRETS.filter((s) => !(s.environment === "production" ? production : repo).has(s.name));
}

export const secretsStep: Step = {
  id: "github-secrets",
  title: "GitHub secrets (Neon API key, deploy hook, bypass secret, production DB URL)",
  isDone: (ctx) => missingSecrets(ctx).length === 0,
  run(ctx) {
    for (const spec of missingSecrets(ctx)) {
      spec.provide(ctx, (value) => setSecret(ctx, spec.name, value, spec.environment));
    }
  },
};

const BUILD_TARGETS = ["production", "preview"] as const;

/**
 * NEON_API_KEY on Vercel (production + preview, sensitive): a key scoped to this Neon project that
 * `pnpm vercel-build` uses to check a preview isn't on the production database, and to trust each
 * deployment's URL in its branch's Neon Auth.
 */
export const vercelBuildKeyStep: Step = {
  id: "vercel-build-key",
  title: "NEON_API_KEY on Vercel (builds check their database and trust their URL)",
  isDone: (ctx) => {
    const targets = envTargets(ctx).get("NEON_API_KEY");
    return BUILD_TARGETS.every((t) => targets?.has(t));
  },
  run(ctx) {
    // One key for both targets. A fresh key replaces (and revokes) any earlier one, so write it to
    // every target, overwriting a value a previous, interrupted run left behind.
    withFreshNeonApiKey(ctx, BUILDS_CREDENTIAL_NAME(ctx.opts.slug), (key) => {
      for (const target of BUILD_TARGETS) {
        ctx.cli.vercel(["env", "add", "NEON_API_KEY", "-e", target, "--sensitive", "--force", "--yes"], {
          cwd: ctx.appDir,
          input: key,
        });
      }
    });
  },
};
