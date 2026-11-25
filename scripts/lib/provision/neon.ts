/**
 * Neon through the Vercel-managed integration: `vercel integration add neon` creates the Neon project
 * (in the "Vercel: <team>" Neon org). Connecting it to the project injects DATABASE_URL,
 * DATABASE_URL_UNPOOLED and NEON_AUTH_BASE_URL into production and into each preview, which gets
 * its own Neon branch. See docs/decisions/0009.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CliError, parseJson, registerSecret } from "../cli";
import { type Context, type Step, waitFor } from "./context";
import { cwdFor, vercelApi } from "./vercel";

export type Resource = { id: string; name: string; projects: { id: string; name?: string }[] };

/** The app's Vercel integration resource (named after the slug), or null. */
export function getResource(ctx: Context): Resource | null {
  let raw: string;
  try {
    raw = ctx.cli.vercel(["integration", "resource", "inspect", ctx.opts.slug, "--json", "--scope", ctx.opts.scope], {
      cwd: cwdFor(ctx),
    });
  } catch (error) {
    if (error instanceof CliError) return null;
    throw error;
  }
  const resource = parseJson<{ resource?: Resource }>(raw, "vercel integration resource inspect").resource;
  return resource ? { ...resource, projects: resource.projects ?? [] } : null;
}

/**
 * A same-named resource is ours only if every project it's connected to is ours. Otherwise it may be
 * another app's live database: refuse rather than adopt (or delete) it.
 */
export function assertResourceIsOurs(resource: Resource, ourProjectId: string | undefined) {
  const foreign = resource.projects.filter((p) => p.id !== ourProjectId);
  if (foreign.length > 0) {
    throw new Error(
      `The Vercel resource "${resource.name}" is connected to other project(s): ${foreign
        .map((p) => p.name ?? p.id)
        .join(", ")}. It isn't this app's database; refusing to touch it.`,
    );
  }
}

type NeonProject = { id: string; name: string; org_id?: string };

/** The Neon project behind the resource, by the store's `externalResourceId` (never by name). */
export function findNeonProject(ctx: Context): NeonProject | null {
  const resource = getResource(ctx);
  if (!resource) return null;
  const raw = parseJson<{ store?: { externalResourceId?: string }; externalResourceId?: string }>(
    vercelApi(ctx, `/storage/stores/${resource.id}`),
    "vercel api /storage/stores",
  );
  const id = (raw.store ?? raw).externalResourceId;
  if (!id) throw new Error(`The Vercel resource "${resource.name}" has no Neon project id (externalResourceId).`);
  return parseJson<NeonProject>(ctx.cli.neon(["projects", "get", id, "--output", "json"]), "neon projects get");
}

/** Vercel store id (store_…) of the app's Neon resource. */
function storeId(ctx: Context): string {
  const id = getResource(ctx)?.id;
  if (!id) throw new Error(`Can't find the Vercel resource "${ctx.opts.slug}".`);
  return id;
}

export const neonResourceStep: Step = {
  id: "neon-resource",
  title: "Neon database via the Vercel-managed integration",
  isDone(ctx) {
    const resource = getResource(ctx);
    if (resource === null) return false;
    assertResourceIsOurs(resource, ctx.facts.vercelProjectId);
    const project = findNeonProject(ctx);
    if (!project) return false;
    ctx.facts.neonProjectId = project.id;
    ctx.facts.neonOrgId = project.org_id;
    return true;
  },
  run(ctx) {
    if (getResource(ctx) === null) {
      // --no-connect: the CLI's connect can't turn on a branch per preview; neonConnectionStep does.
      ctx.cli.vercel(
        [
          "integration",
          "add",
          "neon",
          "--name",
          ctx.opts.slug,
          "--meta",
          `region=${ctx.opts.region}`,
          "--meta",
          `auth=${ctx.opts.auth}`,
          "--billing-plan",
          "free_v3",
          "--no-connect",
          "--scope",
          ctx.opts.scope,
        ],
        { cwd: ctx.appDir, inherit: true },
      );
    }
    const project = findNeonProject(ctx);
    if (!project) throw new Error(`Created the Vercel resource "${ctx.opts.slug}" but can't find its Neon project.`);
    ctx.facts.neonProjectId = project.id;
    ctx.facts.neonOrgId = project.org_id;
  },
};

type Connection = {
  projectId: string;
  envVarEnvironments?: string[];
  deployments?: { required?: boolean; actions?: { slug: string; environments: string[] }[] };
};

/**
 * The connection we want. Never `development` (that would point local dev at production; local dev
 * uses the `dev` branch via db:env). `deployments` = the dashboard's "Create database branch for
 * deployment: Preview": each preview gets its own `preview/<git-branch>` Neon branch.
 */
export function connectionBody(projectId: string) {
  return {
    projectId,
    envVarEnvironments: ["production", "preview"],
    makeEnvVarsSensitive: true,
    deployments: { required: true, actions: [{ slug: "Neon", environments: ["preview"] }] },
  };
}

export function isWantedConnection(connection: Connection | undefined): boolean {
  if (!connection) return false;
  const envs = new Set(connection.envVarEnvironments ?? []);
  const branchesPreviews = (connection.deployments?.actions ?? []).some((a) => a.environments.includes("preview"));
  return envs.has("production") && envs.has("preview") && !envs.has("development") && branchesPreviews;
}

function currentConnection(ctx: Context, store: string): Connection | undefined {
  const out = vercelApi(ctx, `/v1/storage/stores/${store}/connections`);
  return parseJson<{ connections: Connection[] }>(out, "store connections").connections.find(
    (c) => c.projectId === ctx.facts.vercelProjectId,
  );
}

export const neonConnectionStep: Step = {
  id: "neon-connection",
  title: "Connect Neon to the project (production + a database branch per preview)",
  isDone: (ctx) => isWantedConnection(currentConnection(ctx, storeId(ctx))),
  run(ctx) {
    const store = storeId(ctx);
    if (currentConnection(ctx, store)) {
      // Never disconnect automatically: on a live app that would pull DATABASE_URL from production.
      throw new Error(
        "The Neon database is connected without a database branch per preview (previews would get " +
          "production's DATABASE_URL). Fix it in Vercel → Storage → the database → Projects: disconnect " +
          "this project, then Connect Project with Production + Preview and 'Create database branch for " +
          "deployment: Preview'. Then re-run.",
      );
    }
    vercelApi(ctx, `/v1/storage/stores/${store}/connections`, {
      method: "POST",
      body: connectionBody(ctx.facts.vercelProjectId ?? ""),
    });
    if (!isWantedConnection(currentConnection(ctx, store))) {
      throw new Error("Connected the Neon database, but preview branching didn't stick. Check Vercel → Storage.");
    }
  },
};

type Branch = { id: string; name: string; default?: boolean; primary?: boolean };

function productionBranch(ctx: Context): { name: string; id: string } {
  const projectId = ctx.facts.neonProjectId ?? "";
  const branches = parseJson<Branch[]>(
    ctx.cli.neon(["branches", "list", "--project-id", projectId, "--output", "json"]),
    "neon branches list",
  );
  const main = branches.find((b) => b.default ?? b.primary);
  if (!main) throw new Error(`Neon project ${projectId} has no default branch.`);
  return { name: main.name, id: main.id };
}

/** Pure: the new neon.project.json contents, keeping comments and branch names from the template. */
export function renderNeonProject(current: string, projectId: string, production: { name: string; id: string }) {
  const json = JSON.parse(current) as Record<string, unknown>;
  return `${JSON.stringify({ ...json, projectId, productionBranch: production }, null, 2)}\n`;
}

/** Pure: points the Neon MCP server in .mcp.json at the app's project. */
export function renderMcpJson(current: string, projectId: string) {
  return current.replace(/(mcp\.neon\.tech\/mcp\?projectId=)[a-z0-9-]+/, `$1${projectId}`);
}

export const neonFilesStep: Step = {
  id: "neon-files",
  title: "Point neon.project.json, .mcp.json and .neon at the new project",
  isDone(ctx) {
    const id = ctx.facts.neonProjectId ?? "";
    const project = JSON.parse(readFileSync(join(ctx.appDir, "neon.project.json"), "utf8")) as {
      projectId: string;
      productionBranch: { name: string; id: string };
    };
    const mcp = readFileSync(join(ctx.appDir, ".mcp.json"), "utf8");
    const done = project.projectId === id && mcp.includes(`projectId=${id}`) && existsSync(join(ctx.appDir, ".neon"));
    if (done) ctx.facts.productionBranch = project.productionBranch;
    return done;
  },
  run(ctx) {
    const id = ctx.facts.neonProjectId ?? "";
    const production = productionBranch(ctx);
    ctx.facts.productionBranch = production;
    const projectFile = join(ctx.appDir, "neon.project.json");
    writeFileSync(projectFile, renderNeonProject(readFileSync(projectFile, "utf8"), id, production));
    const mcpFile = join(ctx.appDir, ".mcp.json");
    writeFileSync(mcpFile, renderMcpJson(readFileSync(mcpFile, "utf8"), id));
    // Local Neon CLI context (gitignored): `neon` commands in the app default to its dev branch.
    writeFileSync(
      join(ctx.appDir, ".neon"),
      `${JSON.stringify({ orgId: ctx.facts.neonOrgId, projectId: id, branch: "dev" }, null, 2)}\n`,
    );
  },
};

function authArgs(ctx: Context) {
  return [
    "--project-id",
    ctx.facts.neonProjectId ?? "",
    "--branch",
    ctx.facts.productionBranch?.name ?? "main",
    "--output",
    "json",
  ];
}

function authState(ctx: Context) {
  const neon = (args: string[]) => ctx.cli.neon([...args, ...authArgs(ctx)]);
  // Not configured yet = a non-JSON message ("Neon Auth is not configured for this branch") or an error.
  let enabled = false;
  try {
    enabled = Boolean((JSON.parse(neon(["neon-auth", "status"])) as { base_url?: string }).base_url);
  } catch (error) {
    if (!(error instanceof CliError || error instanceof SyntaxError)) throw error;
  }
  if (!enabled) return { enabled, providers: new Set<string>(), localhost: false };
  const providers = new Set(
    parseJson<{ id: string }[]>(neon(["neon-auth", "oauth-provider", "list"]), "oauth-provider list").map((p) => p.id),
  );
  const localhost = parseJson<{ allow_localhost: boolean }>(
    neon(["neon-auth", "domain", "allow-localhost", "get"]),
    "allow-localhost get",
  ).allow_localhost;
  return { enabled, providers, localhost };
}

/**
 * Configures Neon Auth on the production branch BEFORE any other branch exists: branches copy
 * their parent's auth config. Localhost stays allowed because CI and `pnpm db:test` branch from
 * production and run the app on localhost. Deployed URLs are trusted at build time instead
 * (scripts/vercel-build.ts): Vercel hostnames can't be matched by a Neon wildcard.
 */
export const neonAuthStep: Step = {
  id: "neon-auth",
  title: "Neon Auth on production (enabled, providers, localhost)",
  skip: (ctx) => (ctx.opts.auth ? false : "no auth"),
  isDone(ctx) {
    const state = authState(ctx);
    return state.enabled && state.localhost && ctx.opts.providers.every((p) => state.providers.has(p));
  },
  run(ctx) {
    const neon = (args: string[]) => ctx.cli.neon([...args, ...authArgs(ctx)]);
    let state = authState(ctx);
    if (!state.enabled) {
      // The integration (`--meta auth=true`) turns auth on a few seconds after creating the project.
      // Wait for it rather than racing it; enable it ourselves only if it never shows up.
      try {
        waitFor(() => authState(ctx).enabled, { timeoutMs: 90_000, what: "Neon Auth from the integration" });
      } catch {
        neon(["neon-auth", "enable"]);
      }
      state = authState(ctx);
      if (!state.enabled) throw new Error("Neon Auth is still not enabled on the production branch.");
    }
    for (const provider of ctx.opts.providers) {
      if (!state.providers.has(provider)) neon(["neon-auth", "oauth-provider", "add", "--provider-id", provider]);
    }
    if (!state.localhost) neon(["neon-auth", "domain", "allow-localhost", "enable"]);
  },
};

type ApiKey = { id: number | string; name: string };

function orgId(ctx: Context): string {
  if (!ctx.facts.neonOrgId) throw new Error("Neon org id not recorded; an earlier step didn't run.");
  return ctx.facts.neonOrgId;
}

/** Revokes every org key with this name (project-scoped keys are org keys). Returns how many. */
export function revokeNeonApiKeys(ctx: Context, name: string): number {
  const keys = parseJson<ApiKey[]>(
    ctx.cli.neon(["api-keys", "list", "--org-id", orgId(ctx), "--output", "json"]),
    "neon api-keys list",
  ).filter((k) => k.name === name);
  for (const key of keys) ctx.cli.neon(["api-keys", "revoke", String(key.id), "--org-id", orgId(ctx)]);
  return keys.length;
}

/**
 * Mints a Neon API key that can only touch this project and hands it to `use`. Exactly one live key
 * per name: earlier keys with the same name are revoked first, and the new key is revoked if `use`
 * fails, so interrupted runs never leave orphan keys behind.
 */
export function withFreshNeonApiKey(ctx: Context, name: string, use: (key: string) => void) {
  revokeNeonApiKeys(ctx, name);
  const out = parseJson<{ id?: number | string; key?: string }>(
    ctx.cli.neon([
      "api-keys",
      "create",
      "--name",
      name,
      "--project-id",
      ctx.facts.neonProjectId ?? "",
      "--output",
      "json",
    ]),
    "neon api-keys create",
  );
  if (!out.key || out.id === undefined) throw new Error("`neon api-keys create` returned no key.");
  try {
    use(registerSecret(out.key));
  } catch (error) {
    ctx.cli.neon(["api-keys", "revoke", String(out.id), "--org-id", orgId(ctx)]);
    throw error;
  }
}

/** Direct (unpooled) production URL, for migrate-prod.yml. */
export function productionDirectUrl(ctx: Context): string {
  const branch = ctx.facts.productionBranch?.name ?? "main";
  return registerSecret(ctx.cli.neon(["connection-string", branch, "--project-id", ctx.facts.neonProjectId ?? ""]));
}
