import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseJson, succeeds } from "../cli";
import { type Context, type Step, WORK_BRANCH, waitFor } from "./context";

export type RepoInfo = {
  full_name: string;
  is_template: boolean;
  template_repository: { full_name: string } | null;
  delete_branch_on_merge?: boolean;
  security_and_analysis?: { secret_scanning_push_protection?: { status: string } } | null;
};

export function getRepo(ctx: Context, repo = ctx.repo): RepoInfo | null {
  try {
    return parseJson<RepoInfo>(ctx.cli.gh(["api", `repos/${repo}`]), `gh api repos/${repo}`);
  } catch {
    return null;
  }
}

/** A repo we may touch: generated from the template by this script, and not a template itself. */
export function assertOurRepo(ctx: Context, repo: RepoInfo) {
  if (repo.is_template) throw new Error(`${repo.full_name} is a template repo; refusing to touch it.`);
  if (repo.template_repository?.full_name.toLowerCase() !== ctx.opts.template.toLowerCase()) {
    throw new Error(
      `${repo.full_name} already exists and wasn't generated from ${ctx.opts.template}. Pick another slug or --owner.`,
    );
  }
}

/** `owner/repo` of a GitHub remote URL (ssh or https), lowercased, or null. */
export function repoOfRemote(url: string): string | null {
  const match = url.trim().match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function isClone(ctx: Context): boolean {
  if (!existsSync(join(ctx.appDir, ".git"))) return false;
  let url = "";
  if (!succeeds(() => (url = ctx.cli.git(["remote", "get-url", "origin"], { cwd: ctx.appDir })))) return false;
  return repoOfRemote(url) === ctx.repo.toLowerCase();
}

export const repoStep: Step = {
  id: "github-repo",
  title: "GitHub repo from the template",
  isDone: (ctx) => getRepo(ctx) !== null && isClone(ctx),
  run(ctx) {
    let created = false;
    if (!getRepo(ctx)) {
      ctx.cli.gh([
        "repo",
        "create",
        ctx.repo,
        "--template",
        ctx.opts.template,
        `--${ctx.opts.visibility}`,
        "--description",
        ctx.opts.description,
      ]);
      created = true;
      waitFor(() => succeeds(() => ctx.cli.gh(["api", `repos/${ctx.repo}/branches/main`])), {
        what: "GitHub to copy the template",
      });
    }
    if (existsSync(ctx.appDir) && !isClone(ctx)) {
      throw new Error(`${ctx.appDir} exists but isn't a clone of ${ctx.repo}. Move it or pass --dir.`);
    }
    if (!existsSync(ctx.appDir)) ctx.cli.gh(["repo", "clone", ctx.repo, ctx.appDir], { cwd: dirname(ctx.appDir) });
    if (created) cancelTemplateCommitRuns(ctx);
  },
};

/**
 * The template's initial commit triggers CI on `main` before any secret exists, so it can only fail.
 * Cancel it (best effort); the first PR and its merge run CI properly.
 */
function cancelTemplateCommitRuns(ctx: Context) {
  type Run = { databaseId: number; status: string };
  try {
    waitFor(
      () => {
        const runs = parseJson<Run[]>(
          ctx.cli.gh(["run", "list", "-R", ctx.repo, "--json", "databaseId,status"]),
          "gh run list",
        );
        const active = runs.filter((r) => r.status !== "completed");
        for (const r of active) succeeds(() => ctx.cli.gh(["run", "cancel", String(r.databaseId), "-R", ctx.repo]));
        return runs.length > 0;
      },
      { timeoutMs: 30_000, what: "the initial CI run" },
    );
  } catch {
    // No run showed up in time: nothing to cancel.
  }
}

const currentBranch = (ctx: Context) => ctx.cli.git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ctx.appDir });

/**
 * The work branch's PR in one of `states` (GitHub: OPEN, MERGED, CLOSED). A closed-unmerged PR never
 * counts, so a re-run opens a new one.
 */
export function findPr(ctx: Context, states = ["OPEN", "MERGED"]): string | null {
  const out = ctx.cli.gh([
    "pr",
    "list",
    "-R",
    ctx.repo,
    "--head",
    WORK_BRANCH,
    "--state",
    "all",
    "--json",
    "url,state",
  ]);
  return (JSON.parse(out) as { url: string; state: string }[]).find((p) => states.includes(p.state))?.url ?? null;
}

/**
 * The work branch after its PR was merged (squash): main holds those changes as one new commit, so
 * the old branch can't be built on without conflicts. It's rebuilt from origin/main instead.
 */
function isStaleAfterMerge(ctx: Context): boolean {
  const git = (args: string[]) => ctx.cli.git(args, { cwd: ctx.appDir });
  if (!succeeds(() => git(["rev-parse", "--verify", `refs/heads/${WORK_BRANCH}`]))) return false;
  if (findPr(ctx, ["OPEN"]) || !findPr(ctx, ["MERGED"])) return false;
  return !succeeds(() => git(["merge-base", "--is-ancestor", "origin/main", WORK_BRANCH]));
}

export const workBranchStep: Step = {
  id: "work-branch",
  title: `Work branch ${WORK_BRANCH}`,
  isDone(ctx) {
    if (currentBranch(ctx) !== WORK_BRANCH) return false;
    ctx.cli.git(["fetch", "--prune", "origin"], { cwd: ctx.appDir });
    return !isStaleAfterMerge(ctx);
  },
  run(ctx) {
    const git = (args: string[]) => ctx.cli.git(args, { cwd: ctx.appDir });
    git(["fetch", "--prune", "origin"]);
    if (isStaleAfterMerge(ctx)) {
      // Only when nothing would be lost: the old branch's content must equal what was merged.
      const clean = git(["status", "--porcelain"]) === "";
      const merged = succeeds(() => git(["diff", "--quiet", "origin/main", WORK_BRANCH]));
      if (!clean || !merged) {
        throw new Error(
          `${WORK_BRANCH} has changes that aren't in main, but its PR was already merged. Move them to a ` +
            `new branch and PR by hand, then delete ${WORK_BRANCH} locally and re-run.`,
        );
      }
      git(["switch", "-C", WORK_BRANCH, "origin/main"]);
      return;
    }
    const local = succeeds(() => git(["rev-parse", "--verify", `refs/heads/${WORK_BRANCH}`]));
    const remote = succeeds(() => git(["rev-parse", "--verify", `refs/remotes/origin/${WORK_BRANCH}`]));
    if (local || remote) git(["switch", WORK_BRANCH]);
    else git(["switch", "-c", WORK_BRANCH, "origin/main"]);
  },
};

export const repoSettingsStep: Step = {
  id: "github-settings",
  title: "GitHub settings (delete merged branches, secret push protection)",
  isDone: (ctx) => {
    const repo = getRepo(ctx);
    // Push protection is free on public repos only; private repos need GitHub Secret Protection.
    const pushProtected =
      ctx.opts.visibility !== "public" ||
      repo?.security_and_analysis?.secret_scanning_push_protection?.status === "enabled";
    return repo?.delete_branch_on_merge === true && pushProtected;
  },
  run(ctx) {
    const body = {
      delete_branch_on_merge: true,
      ...(ctx.opts.visibility === "public" && {
        security_and_analysis: {
          secret_scanning: { status: "enabled" },
          secret_scanning_push_protection: { status: "enabled" },
        },
      }),
    };
    ctx.cli.gh(["api", "-X", "PATCH", `repos/${ctx.repo}`, "--input", "-"], { input: JSON.stringify(body) });
  },
};

/** Required checks: the job names in .github/workflows/ci.yml. */
export const REQUIRED_CHECKS = ["checks", "secret scan", "db-e2e (auth)", "db-e2e (noauth)"];
const RULESET_NAME = "protect-main";

export function rulesetBody() {
  return {
    name: RULESET_NAME,
    target: "branch",
    enforcement: "active",
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: REQUIRED_CHECKS.map((context) => ({ context })),
        },
      },
    ],
  };
}

type RulesetSummary = { id: number; name: string };
type Ruleset = RulesetSummary & {
  enforcement?: string;
  rules: { type: string; parameters?: { required_status_checks?: { context: string }[] } }[];
};

function findRuleset(ctx: Context): Ruleset | null {
  const list = parseJson<RulesetSummary[]>(ctx.cli.gh(["api", `repos/${ctx.repo}/rulesets`]), "gh api rulesets");
  const summary = list.find((r) => r.name === RULESET_NAME);
  if (!summary) return null;
  return parseJson<Ruleset>(ctx.cli.gh(["api", `repos/${ctx.repo}/rulesets/${summary.id}`]), "gh api ruleset");
}

export const rulesetStep: Step = {
  id: "github-ruleset",
  title: `Protect main (ruleset "${RULESET_NAME}": PR + green CI)`,
  isDone: (ctx) => {
    const ruleset = findRuleset(ctx);
    if (ruleset?.enforcement !== "active") return false;
    const types = new Set(ruleset.rules.map((r) => r.type));
    if (!["deletion", "non_fast_forward", "pull_request"].every((t) => types.has(t))) return false;
    const checks =
      ruleset.rules
        .find((r) => r.type === "required_status_checks")
        ?.parameters?.required_status_checks?.map((c) => c.context)
        .sort() ?? [];
    return JSON.stringify(checks) === JSON.stringify([...REQUIRED_CHECKS].sort());
  },
  run(ctx) {
    const existing = findRuleset(ctx);
    const args = existing
      ? ["api", "-X", "PUT", `repos/${ctx.repo}/rulesets/${existing.id}`, "--input", "-"]
      : ["api", "-X", "POST", `repos/${ctx.repo}/rulesets`, "--input", "-"];
    ctx.cli.gh(args, { input: JSON.stringify(rulesetBody()) });
    if (ctx.opts.visibility === "private") {
      ctx.log.warn("   Private repo: GitHub only enforces this ruleset on paid plans.");
    }
  },
};

/** The `production` environment holds the production DB secret and only deploys from main. */
export const environmentStep: Step = {
  id: "github-environment",
  title: "GitHub environment `production` (main only)",
  isDone: (ctx) => {
    try {
      type Policies = { branch_policies: { name: string }[] };
      const policies = parseJson<Policies>(
        ctx.cli.gh(["api", `repos/${ctx.repo}/environments/production/deployment-branch-policies`]),
        "gh api deployment-branch-policies",
      );
      return policies.branch_policies.some((p) => p.name === "main");
    } catch {
      return false;
    }
  },
  run(ctx) {
    ctx.cli.gh(["api", "-X", "PUT", `repos/${ctx.repo}/environments/production`, "--input", "-"], {
      input: JSON.stringify({ deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } }),
    });
    ctx.cli.gh(
      ["api", "-X", "POST", `repos/${ctx.repo}/environments/production/deployment-branch-policies`, "--input", "-"],
      { input: JSON.stringify({ name: "main", type: "branch" }) },
    );
  },
};

type GhSecret = { name: string };

export function listSecrets(ctx: Context, environment?: string): Set<string> {
  const args = ["secret", "list", "-R", ctx.repo, "--json", "name"];
  if (environment) args.push("--env", environment);
  return new Set(parseJson<GhSecret[]>(ctx.cli.gh(args), "gh secret list").map((s) => s.name));
}

/** Sets a GitHub Actions secret. The value goes through stdin, never argv. */
export function setSecret(ctx: Context, name: string, value: string, environment?: string) {
  const args = ["secret", "set", name, "-R", ctx.repo];
  if (environment) args.push("--env", environment);
  ctx.cli.gh(args, { input: value });
}

export function listVariables(ctx: Context): Map<string, string> {
  type Variable = { name: string; value: string };
  const vars = parseJson<Variable[]>(
    ctx.cli.gh(["variable", "list", "-R", ctx.repo, "--json", "name,value"]),
    "gh variable list",
  );
  return new Map(vars.map((v) => [v.name, v.value]));
}

export function setVariable(ctx: Context, name: string, value: string) {
  ctx.cli.gh(["variable", "set", name, "-R", ctx.repo, "--body", value]);
}
