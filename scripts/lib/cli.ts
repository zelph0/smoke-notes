/**
 * One way to call the external CLIs (gh, neon, vercel, pnpm, git) from scripts.
 * - Secrets travel through stdin (`input`), never argv, so they don't show up in `ps` or logs.
 * - Errors are redacted: Postgres passwords and every value passed to `registerSecret()` become `***`.
 * - Output is returned, not printed. `inherit: true` streams output to stderr instead (long builds),
 *   so stdout stays clean for `--json`.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export type RunOptions = {
  cwd?: string;
  /** Written to the command's stdin. Use this for secrets. */
  input?: string;
  /** Stream the command's output to our stderr instead of capturing it. */
  inherit?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type Run = (command: string, args: string[], options?: RunOptions) => string;

const secrets = new Set<string>();

/** Remember a secret value so it is masked in any error message. Returns the value. */
export function registerSecret(value: string): string {
  if (value.length >= 8) secrets.add(value);
  return value;
}

export function redact(text: string): string {
  let out = text.replace(/(postgres(?:ql)?:\/\/)[^\s"'@/]+@/g, "$1***@");
  for (const secret of secrets) out = out.split(secret).join("***");
  return out;
}

export class CliError extends Error {
  constructor(
    readonly command: string,
    readonly status: number | null,
    readonly stderr: string,
  ) {
    super(`\`${command}\` failed${status === null ? "" : ` (exit ${status})`}${stderr ? `:\n${stderr}` : ""}`);
    this.name = "CliError";
  }
}

export const run: Run = (command, args, { cwd, input, inherit, env } = {}) => {
  try {
    const out = execFileSync(command, args, {
      cwd,
      env: env ?? process.env,
      encoding: "utf8",
      input,
      maxBuffer: 64 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", inherit ? 2 : "pipe", inherit ? 2 : "pipe"],
    });
    return (out ?? "").trim();
  } catch (error) {
    const e = error as { status?: number | null; stderr?: string | Buffer; stdout?: string | Buffer };
    const detail = `${String(e.stderr ?? "")}\n${String(e.stdout ?? "")}`.trim();
    throw new CliError(
      redact([command.split("/").pop(), ...args].join(" ")),
      e.status ?? null,
      redact(detail).slice(-3000),
    );
  }
};

export type Cli = {
  gh(args: string[], options?: RunOptions): string;
  neon(args: string[], options?: RunOptions): string;
  vercel(args: string[], options?: RunOptions): string;
  pnpm(args: string[], options?: RunOptions): string;
  git(args: string[], options?: RunOptions): string;
};

/**
 * `toolsRoot` is the checkout whose node_modules holds the pinned `neon` and `vercel` CLIs
 * (the template checkout running the script), so provisioning never depends on global installs.
 */
export function createCli(toolsRoot: string, runner: Run = run): Cli {
  const bin = (name: string) => join(toolsRoot, "node_modules", ".bin", name);
  return {
    gh: (args, options) => runner("gh", args, options),
    neon: (args, options) => runner(bin("neon"), [...args, "--no-color", "--no-analytics"], options),
    vercel: (args, options) => runner(bin("vercel"), [...args, "--non-interactive", "--no-color"], options),
    pnpm: (args, options) => runner("pnpm", args, options),
    git: (args, options) => runner("git", args, options),
  };
}

export function parseJson<T>(text: string, what: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${what}, got: ${redact(text).slice(0, 300)}`);
  }
}

/** True when the command succeeds. For existence checks (`gh api repos/x`, ...). */
export function succeeds(fn: () => unknown): boolean {
  try {
    fn();
    return true;
  } catch (error) {
    if (error instanceof CliError) return false;
    throw error;
  }
}
