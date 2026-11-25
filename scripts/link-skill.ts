/**
 * `pnpm skill:link`: makes /new-app available in every Claude Code session on this machine by
 * symlinking skills/new-app into ~/.claude/skills/new-app. The skill finds this checkout through
 * the link, so `git pull` here updates it. Safe to re-run; never overwrites a real folder.
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills", "new-app");
const link = join(homedir(), ".claude", "skills", "new-app");

if (!existsSync(join(target, "SKILL.md"))) {
  console.error(`${target}/SKILL.md not found. Run this from the app-template checkout.`);
  process.exit(1);
}
mkdirSync(dirname(link), { recursive: true });

const existing = lstatSync(link, { throwIfNoEntry: false });
if (existing?.isSymbolicLink()) {
  if (resolve(dirname(link), readlinkSync(link)) === target) {
    console.info(`Already linked: ${link} -> ${target}`);
    process.exit(0);
  }
  unlinkSync(link); // points at an old checkout: repoint it
} else if (existing) {
  console.error(`${link} exists and isn't a symlink. Move it away, then re-run.`);
  process.exit(1);
}
symlinkSync(target, link, "dir");
console.info(`Linked ${link} -> ${target}. Type /new-app in a new Claude Code session.`);
