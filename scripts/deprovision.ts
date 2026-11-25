/**
 * `pnpm deprovision <slug> [--owner <login>] [--scope <team>] [--confirm <slug>]`: deletes what
 * `pnpm provision` created, for throwaway or abandoned apps. PERMANENT: the Neon database (all
 * branches and data), the Vercel project and the GitHub repo cannot be recovered.
 *
 * It lists what exists, then asks you to type the slug (or pass `--confirm <slug>`). It refuses
 * template repos and repos not generated from this template. Skips anything already gone, so
 * re-running is safe. The local clone is left alone; delete the folder yourself.
 */
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createCli, parseJson } from "./lib/cli";
import { ACTIONS_CREDENTIAL_NAME, BUILDS_CREDENTIAL_NAME, type Context } from "./lib/provision/context";
import { findNeonProject, revokeNeonApiKeys } from "./lib/provision/neon";
import { SLUG } from "./lib/provision/options";
import { checkExisting } from "./lib/provision/ownership";

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Action = { what: string; run(): void };

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { owner: { type: "string" }, scope: { type: "string" }, confirm: { type: "string" } },
  });
  const slug = positionals[0] ?? "";
  if (positionals.length !== 1 || !SLUG.test(slug)) {
    throw new Error("Usage: pnpm deprovision <slug> [--owner <login>] [--scope <team>] [--confirm <slug>]");
  }
  if (slug === "app-template") throw new Error("Refusing to delete the template.");

  const cli = createCli(TEMPLATE_ROOT);
  const owner = values.owner ?? cli.gh(["api", "user", "--jq", ".login"]);
  type Whoami = { team?: { id: string; slug: string }; teams?: { id: string; slug: string }[] };
  const whoami = parseJson<Whoami>(cli.vercel(["whoami", "--format", "json"], { cwd: TEMPLATE_ROOT }), "vercel whoami");
  const scope = values.scope ?? whoami.team?.slug ?? "";
  const team = [whoami.team, ...(whoami.teams ?? [])].find((t) => t?.slug === scope);
  if (!team) throw new Error(`Vercel team "${scope}" not found. Pass --scope.`);
  const template = cli.gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
    cwd: TEMPLATE_ROOT,
  });

  const ctx: Context = {
    opts: {
      slug,
      name: slug,
      description: slug,
      owner,
      template,
      scope: team.slug,
      teamId: team.id,
      visibility: "public",
      auth: true,
      providers: [],
      dir: TEMPLATE_ROOT,
      region: "iad1",
      pr: false,
      verify: false,
      json: false,
      preflight: false,
    },
    cli,
    repo: `${owner}/${slug}`,
    appDir: TEMPLATE_ROOT, // a neutral cwd for CLI calls; nothing is linked here
    facts: {},
    log: { info: console.error, warn: console.error },
  };
  const actions: Action[] = [];

  // Refuses anything not provably this app's: a repo not generated from the template, a Vercel
  // project connected to another repo, a Neon resource connected to another project.
  const { repo, project, resource } = checkExisting(ctx);
  if (!repo) console.warn(`GitHub repo ${ctx.repo} not found; ownership checked through the Vercel project instead.`);

  const neonProject = resource ? findNeonProject(ctx) : null;
  if (neonProject?.org_id) {
    ctx.facts.neonOrgId = neonProject.org_id;
    const names = [ACTIONS_CREDENTIAL_NAME(slug), BUILDS_CREDENTIAL_NAME(slug)];
    type Key = { id: number | string; name: string };
    const keys = parseJson<Key[]>(
      cli.neon(["api-keys", "list", "--org-id", neonProject.org_id, "--output", "json"]),
      "neon api-keys list",
    ).filter((k) => names.includes(k.name));
    for (const name of new Set(keys.map((k) => k.name))) {
      actions.push({ what: `Neon API key(s) "${name}"`, run: () => revokeNeonApiKeys(ctx, name) });
    }
  }

  if (resource) {
    actions.push({
      what: `Neon database "${slug}"${neonProject ? ` (${neonProject.id})` : ""}: every branch and all data`,
      run: () =>
        cli.vercel(["integration", "resource", "delete", slug, "--disconnect-all", "--yes", "--scope", team.slug], {
          cwd: TEMPLATE_ROOT,
        }),
    });
  }

  if (project) {
    actions.push({
      what: `Vercel project ${team.slug}/${slug} (deployments, env vars, domains, deploy hook)`,
      run: () =>
        cli.vercel(["project", "delete", slug, "--confirm-name", slug, "--scope", team.slug], { cwd: TEMPLATE_ROOT }),
    });
  }

  if (repo) {
    actions.push({
      what: `GitHub repo ${ctx.repo} (code, issues, PRs, Actions history)`,
      run: () => cli.gh(["repo", "delete", ctx.repo, "--yes"]),
    });
  }

  if (actions.length === 0) {
    console.info(`Nothing left to delete for "${slug}".`);
    return;
  }
  console.info(`This permanently deletes:\n${actions.map((a) => `  - ${a.what}`).join("\n")}\n`);

  let confirmed = values.confirm === slug;
  if (!confirmed) {
    if (!process.stdin.isTTY) throw new Error(`Not a terminal: pass --confirm ${slug} to approve.`);
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    confirmed = (await rl.question(`Type "${slug}" to delete all of it: `)).trim() === slug;
    rl.close();
  }
  if (!confirmed) throw new Error("Not confirmed; nothing was deleted.");

  for (const action of actions) {
    action.run();
    console.info(`✓ deleted ${action.what}`);
  }
  console.info(`\nThe local clone (if any) is untouched: delete its folder yourself.`);
}

const isMain = process.argv[1] && relative(process.cwd(), process.argv[1]).endsWith("scripts/deprovision.ts");
if (isMain) {
  main().catch((error: Error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
