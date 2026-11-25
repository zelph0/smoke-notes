/**
 * `pnpm auth:remove [--root <dir>] [--dry-run]`: removes the auth module cleanly.
 * Deterministic and idempotent: running it twice is a no-op. Provisioning step 6 runs it
 * when an app doesn't want auth, and CI runs it on a copy to prove the template still
 * builds and passes without auth.
 *
 * Markers (see docs/template-contract.md):
 *   - a file whose FIRST line contains `@auth-module: file`  -> file deleted
 *   - a line ENDING with `// @auth-module` or `# @auth-module` -> line deleted
 *   - a line `// @no-auth: <code>` or `# @no-auth: <code>`     -> becomes `<code>`
 *   - lines between `@auth-module:start` and `@auth-module:end` (inclusive) -> deleted
 *   - src/modules/auth/ and tests/e2e/auth/                    -> deleted
 *   - the `@neon/auth` dependency in package.json             -> removed
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const AUTH_DIRS = ["src/modules/auth", "tests/e2e/auth"];
const AUTH_DEPENDENCIES = ["@neon/auth"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "src/generated", "playwright-report", "test-results"]);
const TEXT_EXTENSIONS = /\.(ts|tsx|mts|js|mjs|json|md|yml|yaml|example|css)$|^\.env\.example$/;
// This script and its test talk ABOUT the markers, so they are never rewritten.
const SELF = new Set(["scripts/remove-auth.ts", "tests/unit/remove-auth.test.ts"]);

const LINE_MARKER = /(\/\/|#|\{\/\*|<!--)\s*@auth-module\s*(\*\/\}|-->)?\s*$/;
const NO_AUTH = /^(\s*)(?:\/\/|#) @no-auth: (.*)$/;
const BLOCK_START = /@auth-module:start/;
const BLOCK_END = /@auth-module:end/;
const FILE_MARKER = /@auth-module: file/;

export type Change = { path: string; action: "deleted" | "rewritten" };

/** Pure transform of one file's text. Returns null when the whole file should be deleted. */
export function transformSource(source: string): string | null {
  const lines = source.split("\n");
  if (lines[0] && FILE_MARKER.test(lines[0])) return null;
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (BLOCK_START.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (BLOCK_END.test(line)) inBlock = false;
      continue;
    }
    if (LINE_MARKER.test(line)) continue;
    const noAuth = NO_AUTH.exec(line);
    out.push(noAuth ? `${noAuth[1]}${noAuth[2]}` : line);
  }
  return out.join("\n");
}

/** Removes now-empty folders left behind by deleted route files (e.g. src/app/auth/sign-in). */
function pruneEmptyDirs(root: string, dir: string) {
  let current = dir;
  while (current && current !== "." && current !== "src" && current !== "src/app") {
    const abs = join(root, current);
    if (!existsSync(abs) || readdirSync(abs).length > 0) return;
    rmSync(abs, { recursive: true });
    current = dirname(current);
  }
}

function walk(root: string, dir: string, files: string[]) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = dir ? `${dir}/${entry}` : entry;
    if (SKIP_DIRS.has(rel) || SKIP_DIRS.has(entry)) continue;
    const abs = join(root, rel);
    if (statSync(abs).isDirectory()) walk(root, rel, files);
    else if (TEXT_EXTENSIONS.test(entry)) files.push(rel);
  }
}

export function removeAuth(root: string, { dryRun = false } = {}): Change[] {
  const changes: Change[] = [];

  for (const dir of AUTH_DIRS) {
    if (existsSync(join(root, dir))) {
      changes.push({ path: dir, action: "deleted" });
      if (!dryRun) rmSync(join(root, dir), { recursive: true, force: true });
    }
  }

  const files: string[] = [];
  walk(root, "", files);
  for (const rel of files) {
    if (SELF.has(rel) || !existsSync(join(root, rel))) continue;
    const abs = join(root, rel);
    const source = readFileSync(abs, "utf8");
    if (!source.includes("@auth-module") && !source.includes("@no-auth:")) continue;
    const next = transformSource(source);
    if (next === null) {
      changes.push({ path: rel, action: "deleted" });
      if (!dryRun) {
        rmSync(abs);
        pruneEmptyDirs(root, dirname(rel));
      }
    } else if (next !== source) {
      changes.push({ path: rel, action: "rewritten" });
      if (!dryRun) writeFileSync(abs, next);
    }
  }

  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, Record<string, string> | undefined>;
  let pkgChanged = false;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const dep of AUTH_DEPENDENCIES) {
      if (pkg[field]?.[dep]) {
        delete pkg[field][dep];
        pkgChanged = true;
      }
    }
  }
  if (pkgChanged) {
    changes.push({ path: "package.json", action: "rewritten" });
    if (!dryRun) writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  if (!dryRun) formatRewritten(root, changes);
  return changes;
}

/** Re-formats rewritten files so the no-auth variant passes `biome check` immediately. */
function formatRewritten(root: string, changes: Change[]) {
  const biome = join(root, "node_modules/.bin/biome");
  const files = changes.filter((c) => c.action === "rewritten" && c.path !== "package.json").map((c) => c.path);
  if (files.length === 0) return;
  if (!existsSync(biome)) {
    console.warn("Biome isn't installed here yet: run `pnpm install && pnpm lint:fix` after this.");
    return;
  }
  execFileSync(biome, ["format", "--write", ...files], { cwd: root, stdio: "ignore" });
}

const isMain = process.argv[1] && relative(process.cwd(), process.argv[1]).endsWith("scripts/remove-auth.ts");
if (isMain) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf("--root");
  const root = (rootIndex >= 0 ? args[rootIndex + 1] : undefined) ?? process.cwd();
  const dryRun = args.includes("--dry-run");
  const changes = removeAuth(root, { dryRun });
  if (changes.length === 0) {
    console.info("Auth module already removed. Nothing to do.");
  } else {
    for (const change of changes) console.info(`${change.action.padEnd(9)} ${change.path}`);
    console.info(
      dryRun
        ? "\nDry run: no files changed."
        : "\nAuth removed. Next: `pnpm install` (updates the lockfile), then `pnpm typecheck && pnpm build`.",
    );
  }
}
