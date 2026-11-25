/**
 * `pnpm db:test`: (re)creates the disposable `test` Neon branch for local integration and
 * e2e runs, then migrates and seeds it and writes .env.test.local. Tests never touch `dev`
 * or `main`. Run it before `pnpm test:integration` / `pnpm test:e2e`, or whenever you want
 * a clean slate. CI does the same per run with a branch per workflow run.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import { neonCli, neonJson, readNeonProject } from "./lib/neon";

const ENV_FILE = ".env.test.local";
const project = readNeonProject();
const branch = project.testBranch;
const base = ["--project-id", project.projectId];

type Branch = { id: string; name: string };
const branches = neonJson<Branch[]>(["branches", "list", ...base]);
const existing = branches.find((b) => b.name === branch);

if (existing) {
  console.info(`Resetting Neon branch "${branch}" to its parent (${project.productionBranch.name})…`);
  neonCli(["branches", "reset", branch, "--parent", ...base]);
} else {
  console.info(`Creating Neon branch "${branch}" from ${project.productionBranch.name}…`);
  neonCli(["branches", "create", "--name", branch, "--parent", project.productionBranch.name, ...base]);
}

const pooled = neonCli(["connection-string", branch, "--pooled", ...base]);
const direct = neonCli(["connection-string", branch, ...base]);

let authBaseUrl = "";
try {
  authBaseUrl = neonJson<{ base_url?: string }>(["neon-auth", "status", "--branch", branch, ...base]).base_url ?? "";
} catch {
  // Auth not enabled on this project (or auth module removed): leave it empty.
}

const previous = existsSync(ENV_FILE) ? parse(readFileSync(ENV_FILE)) : {};
const values: Record<string, string> = {
  DATABASE_URL: pooled,
  DATABASE_URL_UNPOOLED: direct,
  NEON_AUTH_BASE_URL: authBaseUrl,
  NEON_AUTH_COOKIE_SECRET: previous.NEON_AUTH_COOKIE_SECRET ?? randomBytes(32).toString("base64"),
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
};
const body = Object.entries(values)
  .filter(([, value]) => value !== "")
  .map(([key, value]) => `${key}="${value}"`)
  .join("\n");
writeFileSync(ENV_FILE, `# Disposable Neon "${branch}" branch. Written by pnpm db:test. Never commit.\n${body}\n`, {
  mode: 0o600,
});
chmodSync(ENV_FILE, 0o600);

const env = { ...process.env, ...values, DOTENV_CONFIG_PATH: ENV_FILE };
console.info("Applying migrations…");
execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { env, stdio: ["ignore", "ignore", "inherit"] });
console.info("Seeding…");
execFileSync("pnpm", ["exec", "prisma", "db", "seed"], { env, stdio: ["ignore", "inherit", "inherit"] });
console.info(`Ready: ${ENV_FILE} points at the "${branch}" branch.`);
