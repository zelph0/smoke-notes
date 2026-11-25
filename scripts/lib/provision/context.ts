import type { Cli } from "../cli";
import type { ProvisionOptions } from "./options";

/** Branch the provisioning commit lives on; becomes the app's first PR. */
export const WORK_BRANCH = "chore/provision";
export const ACTIONS_CREDENTIAL_NAME = (slug: string) => `${slug} GitHub Actions`;
/** Name of the Neon key Vercel builds use to trust their own URL in Neon Auth. */
export const BUILDS_CREDENTIAL_NAME = (slug: string) => `${slug} Vercel builds`;

export type Resolved = ProvisionOptions & { owner: string; template: string; scope: string; teamId: string };

/** Values discovered while provisioning, filled in by the steps that find them. */
export type Facts = {
  vercelProjectId?: string;
  vercelOrgId?: string;
  neonProjectId?: string;
  neonOrgId?: string;
  productionBranch?: { name: string; id: string };
  prUrl?: string;
};

export type Logger = { info(message: string): void; warn(message: string): void };

export type Context = {
  opts: Resolved;
  cli: Cli;
  /** owner/slug */
  repo: string;
  appDir: string;
  facts: Facts;
  log: Logger;
};

export type Step = {
  id: string;
  title: string;
  /** Return a reason to skip the step (not applicable), or false. */
  skip?(ctx: Context): string | false;
  /** Read real state; true means nothing to do. Must not change anything. */
  isDone(ctx: Context): boolean;
  run(ctx: Context): void;
};

export type StepOutcome = { id: string; status: "done" | "already" | "skipped"; note?: string };

/**
 * Runs steps in order. A finished step is reported as "already done", so re-running the whole
 * script is safe and resumes where a failed run stopped. The first failure stops the run.
 */
export function runSteps(steps: Step[], ctx: Context): StepOutcome[] {
  const outcomes: StepOutcome[] = [];
  for (const step of steps) {
    const reason = step.skip?.(ctx);
    if (reason) {
      ctx.log.info(`–  ${step.title}: skipped (${reason})`);
      outcomes.push({ id: step.id, status: "skipped", note: reason });
      continue;
    }
    if (step.isDone(ctx)) {
      ctx.log.info(`↷  ${step.title}: already done`);
      outcomes.push({ id: step.id, status: "already" });
      continue;
    }
    ctx.log.info(`…  ${step.title}`);
    try {
      step.run(ctx);
    } catch (error) {
      ctx.log.warn(`✗  ${step.title} failed. Fix the cause and re-run the same command: finished steps are skipped.`);
      throw error;
    }
    ctx.log.info(`✓  ${step.title}`);
    outcomes.push({ id: step.id, status: "done" });
  }
  return outcomes;
}

/** Polls `check` until true or the timeout passes. Synchronous on purpose: the steps are sequential. */
export function waitFor(check: () => boolean, { timeoutMs = 90_000, intervalMs = 3_000, what = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}.`);
}
