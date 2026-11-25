/**
 * Same-named things that already exist (GitHub repo, Vercel project, Neon resource) may belong to
 * a previous run of `pnpm provision` for this app, or to a different, live app. Provision only
 * adopts, and deprovision only deletes, what this check proves is ours.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "./context";
import { assertOurRepo, getRepo, type RepoInfo } from "./github";
import { assertResourceIsOurs, getResource, type Resource } from "./neon";
import { getVercelProject, type VercelProject } from "./vercel";

export type Existing = { repo: RepoInfo | null; project: VercelProject | null; resource: Resource | null };

/** Project id from the app folder's .vercel/project.json, written by an earlier run's `vercel link`. */
function localLinkProjectId(ctx: Context): string | undefined {
  const file = join(ctx.appDir, ".vercel", "project.json");
  if (!existsSync(file)) return undefined;
  return (JSON.parse(readFileSync(file, "utf8")) as { projectId?: string }).projectId;
}

/** Pure decision over what exists. Throws with the reason when something isn't provably ours. */
export function assertOwnership(repoName: string, existing: Existing, localProjectId?: string) {
  const repoIsOurs = existing.repo !== null; // getRepo + assertOurRepo already checked its template
  const { project, resource } = existing;
  if (project) {
    const link = project.link;
    const linkedRepo = link?.type === "github" ? `${link.org}/${link.repo}`.toLowerCase() : null;
    if (linkedRepo !== null && linkedRepo !== repoName.toLowerCase()) {
      throw new Error(
        `The Vercel project "${project.name}" is connected to ${linkedRepo}, not ${repoName}. It's another app; refusing to touch it.`,
      );
    }
    if (linkedRepo === null && !repoIsOurs && localProjectId !== project.id) {
      throw new Error(
        `A Vercel project "${project.name}" exists, isn't connected to any repo, and ${repoName} doesn't exist: ownership can't be verified. Refusing to touch it.`,
      );
    }
  }
  if (resource) {
    assertResourceIsOurs(resource, project?.id);
    if (!project && !repoIsOurs) {
      throw new Error(
        `A Neon resource "${resource.name}" exists but neither its Vercel project nor ${repoName} does: ownership can't be verified. Refusing to touch it.`,
      );
    }
  }
}

/** Reads what exists for this app and checks it's all ours (the repo's template origin included). */
export function checkExisting(ctx: Context): Existing {
  const repo = getRepo(ctx);
  if (repo) assertOurRepo(ctx, repo);
  const existing: Existing = { repo, project: getVercelProject(ctx), resource: getResource(ctx) };
  assertOwnership(ctx.repo, existing, localLinkProjectId(ctx));
  return existing;
}
