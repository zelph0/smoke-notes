/** Steps that change the new app's files (identity, auth module, theme), check it, and open the PR. */
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { succeeds } from "../cli";
import { renderTemplateConfig } from "../template-config";
import { type Context, type Step, WORK_BRANCH } from "./context";
import { findPr } from "./github";

const inApp = (ctx: Context, path: string) => join(ctx.appDir, path);
const pnpm = (ctx: Context, args: string[]) => ctx.cli.pnpm(args, { cwd: ctx.appDir, inherit: true });

export const installStep: Step = {
  id: "install",
  title: "Install dependencies",
  isDone: (ctx) => existsSync(inApp(ctx, "node_modules/.modules.yaml")),
  run: (ctx) => pnpm(ctx, ["install", "--frozen-lockfile"]),
};

/** Options that shape what gets created. Re-runs must match them; identity and theme may change. */
export function recordedOptions(ctx: Context) {
  const { owner, visibility, auth, providers, region, scope } = ctx.opts;
  return { owner, visibility, auth, providers: [...providers].sort(), region, scope };
}

/** Pure: throws when a re-run's options differ from the ones the app was provisioned with. */
export function assertSameOptions(recorded: Record<string, unknown>, current: Record<string, unknown>) {
  const changed = Object.keys(current).filter((k) => JSON.stringify(recorded[k]) !== JSON.stringify(current[k]));
  if (changed.length > 0) {
    throw new Error(
      `This app was provisioned with different options (${changed
        .map((k) => `${k}: ${JSON.stringify(recorded[k])} → ${JSON.stringify(current[k])}`)
        .join(", ")}). Re-run with the original options; changing them after the fact isn't supported.`,
    );
  }
}

const OPTIONS_FILE = "provision.json";

export const optionsStep: Step = {
  id: "options",
  title: `Record the provisioning options (${OPTIONS_FILE})`,
  isDone(ctx) {
    const file = inApp(ctx, OPTIONS_FILE);
    if (!existsSync(file)) return false;
    assertSameOptions(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>, recordedOptions(ctx));
    return true;
  },
  run(ctx) {
    writeFileSync(inApp(ctx, OPTIONS_FILE), `${JSON.stringify(recordedOptions(ctx), null, 2)}\n`);
    if (existsSync(inApp(ctx, "node_modules/.bin/biome"))) {
      ctx.cli.pnpm(["exec", "biome", "format", "--write", OPTIONS_FILE], { cwd: ctx.appDir });
    }
  },
};

const identityOf = (ctx: Context) => ({ name: ctx.opts.name, slug: ctx.opts.slug, description: ctx.opts.description });

export const identityStep: Step = {
  id: "identity",
  title: "App identity (template.config.ts + template:sync)",
  isDone(ctx) {
    const file = inApp(ctx, "template.config.ts");
    const source = readFileSync(file, "utf8");
    if (renderTemplateConfig(source, identityOf(ctx)) !== source) return false;
    return succeeds(() => ctx.cli.pnpm(["template:check"], { cwd: ctx.appDir }));
  },
  run(ctx) {
    const file = inApp(ctx, "template.config.ts");
    writeFileSync(file, renderTemplateConfig(readFileSync(file, "utf8"), identityOf(ctx)));
    ctx.cli.pnpm(["template:sync"], { cwd: ctx.appDir });
  },
};

/** Files that only make sense in the template itself (the /new-app skill and its linker, the build spec). */
export const TEMPLATE_ONLY = ["skills", "scripts/link-skill.ts", "TEMPLATE_SPEC.md"];
const TEMPLATE_ONLY_SCRIPTS = ["skill:link"];

function packageScripts(ctx: Context): Record<string, string> {
  return (
    (JSON.parse(readFileSync(inApp(ctx, "package.json"), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {}
  );
}

export const templateOnlyStep: Step = {
  id: "template-only",
  title: "Remove template-only files (skills/, skill:link, TEMPLATE_SPEC.md)",
  isDone: (ctx) =>
    TEMPLATE_ONLY.every((path) => !existsSync(inApp(ctx, path))) &&
    TEMPLATE_ONLY_SCRIPTS.every((name) => !(name in packageScripts(ctx))),
  run(ctx) {
    for (const path of TEMPLATE_ONLY) rmSync(inApp(ctx, path), { recursive: true, force: true });
    const file = inApp(ctx, "package.json");
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts?: Record<string, string> };
    for (const name of TEMPLATE_ONLY_SCRIPTS) delete pkg.scripts?.[name];
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  },
};

const PROVIDERS_FILE = "src/modules/auth/providers.ts";
const PROVIDERS_LINE = /^export const socialProviders: SocialProvider\[\] = \[.*\];$/m;

/** Pure: the providers file with its list set to `providers` (the sign-in buttons, in order). */
export function renderProviders(source: string, providers: string[]): string {
  if (!PROVIDERS_LINE.test(source)) throw new Error(`${PROVIDERS_FILE}: the socialProviders line has changed shape.`);
  const list = providers.map((p) => `"${p}"`).join(", ");
  return source.replace(PROVIDERS_LINE, `export const socialProviders: SocialProvider[] = [${list}];`);
}

/** The sign-in form shows exactly the providers enabled in Neon Auth. */
export const authProvidersStep: Step = {
  id: "auth-providers",
  title: `Sign-in buttons (${PROVIDERS_FILE})`,
  skip: (ctx) => (ctx.opts.auth ? false : "no auth"),
  isDone(ctx) {
    const source = readFileSync(inApp(ctx, PROVIDERS_FILE), "utf8");
    return renderProviders(source, ctx.opts.providers) === source;
  },
  run(ctx) {
    const file = inApp(ctx, PROVIDERS_FILE);
    writeFileSync(file, renderProviders(readFileSync(file, "utf8"), ctx.opts.providers));
  },
};

/** Runs before the dev database exists: the seed differs without auth. */
export const removeAuthStep: Step = {
  id: "remove-auth",
  title: "Remove the auth module",
  skip: (ctx) => (ctx.opts.auth ? "app keeps auth" : false),
  isDone: (ctx) =>
    !existsSync(inApp(ctx, "src/modules/auth")) &&
    !readFileSync(inApp(ctx, "package.json"), "utf8").includes("@neon/auth"),
  run(ctx) {
    pnpm(ctx, ["auth:remove"]);
    pnpm(ctx, ["install", "--no-frozen-lockfile"]);
  },
};

/** What `/new-app`'s styling step hands over: theme.css, fonts.ts and optional component variants. */
export function themeFiles(themeDir: string): { from: string; to: string }[] {
  const files: { from: string; to: string }[] = [];
  const add = (from: string, to: string) =>
    existsSync(join(themeDir, from)) && files.push({ from: join(themeDir, from), to });
  add("theme.css", "src/styles/theme.css");
  add("fonts.ts", "src/config/fonts.ts");
  const ui = join(themeDir, "components/ui");
  if (existsSync(ui)) {
    for (const name of readdirSync(ui).filter((f) => f.endsWith(".tsx"))) {
      files.push({ from: join(ui, name), to: `src/components/ui/${name}` });
    }
  }
  if (files.length === 0)
    throw new Error(`--theme-dir ${themeDir} has none of theme.css, fonts.ts, components/ui/*.tsx.`);
  return files;
}

export const themeStep: Step = {
  id: "theme",
  title: "Apply the theme",
  skip: (ctx) => (ctx.opts.themeDir ? false : "no --theme-dir: keeping the template's look"),
  isDone: (ctx) =>
    themeFiles(ctx.opts.themeDir ?? "").every(
      ({ from, to }) =>
        existsSync(inApp(ctx, to)) && readFileSync(from, "utf8") === readFileSync(inApp(ctx, to), "utf8"),
    ),
  run(ctx) {
    for (const { from, to } of themeFiles(ctx.opts.themeDir ?? "")) copyFileSync(from, inApp(ctx, to));
  },
};

/** `prisma migrate status` exits non-zero while migrations are pending (or the DB is unreachable). */
const devIsMigrated = (ctx: Context) =>
  succeeds(() => ctx.cli.pnpm(["exec", "prisma", "migrate", "status"], { cwd: ctx.appDir }));

export const devDatabaseStep: Step = {
  id: "dev-database",
  title: "Dev database (Neon `dev` branch, .env.local, migrate + seed)",
  isDone: (ctx) =>
    existsSync(inApp(ctx, ".env.local")) &&
    readFileSync(inApp(ctx, ".env.local"), "utf8").includes("DATABASE_URL=") &&
    branchExists(ctx, "dev") &&
    devIsMigrated(ctx),
  run(ctx) {
    pnpm(ctx, ["db:env"]);
    // db:env migrates + seeds only when it creates the branch. If an earlier run stopped after
    // creating it, finish the job here (the seed is safe to repeat).
    if (!devIsMigrated(ctx)) {
      pnpm(ctx, ["exec", "prisma", "migrate", "deploy"]);
      pnpm(ctx, ["exec", "prisma", "db", "seed"]);
    }
  },
};

function branchExists(ctx: Context, name: string): boolean {
  if (!ctx.facts.neonProjectId) return false;
  const out = ctx.cli.neon(["branches", "list", "--project-id", ctx.facts.neonProjectId, "--output", "json"]);
  return (JSON.parse(out) as { name: string }[]).some((b) => b.name === name);
}

export const verifyStep: Step = {
  id: "verify",
  title: "Typecheck, lint, unit tests and build in the new app",
  skip: (ctx) => (ctx.opts.verify ? false : "--no-verify"),
  isDone: () => false,
  run(ctx) {
    for (const script of ["typecheck", "lint", "test", "build"]) pnpm(ctx, [script]);
  },
};

const git = (ctx: Context, args: string[]) => ctx.cli.git(args, { cwd: ctx.appDir });

export function prBody(ctx: Context): string {
  const f = ctx.facts;
  return [
    `Provisioned by \`pnpm provision ${ctx.opts.slug}\` from ${ctx.opts.template}.`,
    "",
    "## What was set up",
    `- Neon project \`${f.neonProjectId}\` (via the Vercel-managed integration), production branch \`${f.productionBranch?.name}\`, \`dev\` branch for local work`,
    `- Vercel project \`${ctx.opts.slug}\` in \`${ctx.opts.scope}\`, connected to this repo; previews get a \`preview/<branch>\` database`,
    `- Auth: ${ctx.opts.auth ? `email codes${ctx.opts.providers.length ? ` + ${ctx.opts.providers.join(", ")}` : ""}` : "removed (`pnpm auth:remove`)"}`,
    `- Theme: ${ctx.opts.themeDir ? "applied from `/new-app`" : "template default"}`,
    "- GitHub: Actions secrets/variables, `production` environment, `protect-main` ruleset",
    "",
    "## Checks run",
    ctx.opts.verify
      ? "`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` passed locally."
      : "Skipped (`--no-verify`).",
    "",
    "Merging this PR is the first production release: `migrate-prod.yml` applies migrations to production, then deploys.",
  ].join("\n");
}

export const pullRequestStep: Step = {
  id: "pull-request",
  title: "Commit, push and open the PR",
  skip: (ctx) => (ctx.opts.pr ? false : "--no-pr"),
  isDone(ctx) {
    const url = findPr(ctx);
    if (url) ctx.facts.prUrl = url;
    if (url === null || git(ctx, ["status", "--porcelain"]) !== "") return false;
    git(ctx, ["fetch", "--prune", "origin"]);
    const pushed = succeeds(() => git(ctx, ["rev-parse", "--verify", `refs/remotes/origin/${WORK_BRANCH}`]))
      ? git(ctx, ["rev-list", "--count", `origin/${WORK_BRANCH}..HEAD`]) === "0"
      : false;
    const sameAsMain = succeeds(() => git(ctx, ["diff", "--quiet", "origin/main", "HEAD"]));
    if (findPr(ctx, ["OPEN"])) {
      // An open PR must also contain main, or GitHub can't build its merge ref and CI never runs.
      return pushed && succeeds(() => git(ctx, ["merge-base", "--is-ancestor", "origin/main", "HEAD"]));
    }
    return sameAsMain; // merged, and nothing new since
  },
  run(ctx) {
    if (git(ctx, ["status", "--porcelain"]) !== "") {
      git(ctx, ["add", "-A"]);
      git(ctx, ["commit", "-m", `chore: provision ${ctx.opts.slug}`]);
    }
    // After a squash merge, main has the same changes as new commits. Merging it resolves cleanly
    // and keeps the next PR mergeable, without rewriting history.
    git(ctx, ["fetch", "--prune", "origin"]);
    try {
      git(ctx, ["merge", "--no-edit", "origin/main"]);
    } catch (error) {
      succeeds(() => git(ctx, ["merge", "--abort"]));
      throw new Error(
        `Merging origin/main into ${WORK_BRANCH} conflicts; resolve it by hand.\n${(error as Error).message}`,
      );
    }
    if (succeeds(() => git(ctx, ["diff", "--quiet", "origin/main", "HEAD"]))) return; // nothing new
    git(ctx, ["push", "-u", "origin", WORK_BRANCH]);
    const existing = findPr(ctx, ["OPEN"]);
    ctx.facts.prUrl =
      existing ??
      ctx.cli.gh(
        [
          "pr",
          "create",
          "-R",
          ctx.repo,
          "--base",
          "main",
          "--head",
          WORK_BRANCH,
          "--title",
          `chore: provision ${ctx.opts.slug}`,
          "--body-file",
          "-",
        ],
        { cwd: ctx.appDir, input: prBody(ctx) },
      );
  },
};
