/**
 * `pnpm db:env`: writes .env.local for the Neon `dev` branch, using your `neon auth` login.
 * Use it on a new computer, or whenever .env.local is lost. Safe to re-run: it refreshes the
 * database and auth URLs, keeps your cookie secret and any other values you added, and never
 * prints secrets. If the `dev` branch doesn't exist yet, it creates it, migrates and seeds it.
 *   --out <file>  write somewhere else (default .env.local)
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import { neonCli, neonJson, readNeonProject } from "./lib/neon";

const outIndex = process.argv.indexOf("--out");
const ENV_FILE = outIndex > -1 ? (process.argv[outIndex + 1] ?? ".env.local") : ".env.local";
const project = readNeonProject();
const branch = project.devBranch;
const base = ["--project-id", project.projectId];

type Branch = { id: string; name: string };
const exists = neonJson<Branch[]>(["branches", "list", ...base]).some((b) => b.name === branch);
if (!exists) {
  console.info(`Creating Neon branch "${branch}" from ${project.productionBranch.name}…`);
  neonCli(["branches", "create", "--name", branch, "--parent", project.productionBranch.name, ...base]);
}

const pooled = neonCli(["connection-string", branch, "--pooled", ...base]);
const direct = neonCli(["connection-string", branch, ...base]);

let authBaseUrl = "";
try {
  authBaseUrl = neonJson<{ base_url?: string }>(["neon-auth", "status", "--branch", branch, ...base]).base_url ?? "";
} catch {
  // Auth not enabled on this project (or auth module removed): leave it out.
}

const previous = existsSync(ENV_FILE) ? parse(readFileSync(ENV_FILE)) : {};
const managed: Record<string, string> = {
  DATABASE_URL: pooled,
  DATABASE_URL_UNPOOLED: direct,
  NEON_AUTH_BASE_URL: authBaseUrl,
  NEON_AUTH_COOKIE_SECRET: previous.NEON_AUTH_COOKIE_SECRET || randomBytes(32).toString("base64"),
  NEXT_PUBLIC_APP_URL: previous.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};
if (!authBaseUrl) delete managed.NEON_AUTH_COOKIE_SECRET;

const extra = Object.entries(previous).filter(([key]) => !(key in managed));
const lines = [...Object.entries(managed), ...extra]
  .filter(([, value]) => value !== "")
  .map(([key, value]) => `${key}="${value}"`);
writeFileSync(
  ENV_FILE,
  `# Neon "${branch}" branch. Written by pnpm db:env; your own additions are kept. Never commit.\n${lines.join("\n")}\n`,
  { mode: 0o600 },
);
chmodSync(ENV_FILE, 0o600);
console.info(
  `Wrote ${ENV_FILE} for the "${branch}" branch (${lines.length} values, ${extra.length} kept from before).`,
);

if (!exists) {
  const env = { ...process.env, ...managed, DOTENV_CONFIG_PATH: ENV_FILE };
  console.info("Applying migrations…");
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { env, stdio: ["ignore", "ignore", "inherit"] });
  console.info("Seeding…");
  execFileSync("pnpm", ["exec", "prisma", "db", "seed"], { env, stdio: ["ignore", "inherit", "inherit"] });
}
