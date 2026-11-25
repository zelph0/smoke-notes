import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type NeonProject = {
  projectId: string;
  productionBranch: { name: string; id: string };
  devBranch: string;
  testBranch: string;
};

export function readNeonProject(root = process.cwd()): NeonProject {
  return JSON.parse(readFileSync(join(root, "neon.project.json"), "utf8")) as NeonProject;
}

/**
 * Runs the pinned `neon` CLI (devDependency). Auth: your `neon auth` login locally,
 * NEON_API_KEY in CI. Output is returned, never printed, because it can contain secrets.
 */
export function neonCli(args: string[]): string {
  return execFileSync("pnpm", ["exec", "neon", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function neonJson<T>(args: string[]): T {
  return JSON.parse(neonCli([...args, "--output", "json"])) as T;
}

/** Endpoint id (ep-...) of a Postgres URL, used to tell branches apart without exposing credentials. */
export function endpointOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0]?.replace(/-pooler$/, "") ?? null;
  } catch {
    return null;
  }
}
