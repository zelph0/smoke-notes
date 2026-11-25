/**
 * `pnpm style:reset`: removes style candidates (src/styles/candidates/) after a style was chosen,
 * restoring the empty, committed state. Safe to run any time.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CANDIDATES_DIR, EMPTY_CANDIDATE_FILES } from "./lib/style-candidates";

mkdirSync(CANDIDATES_DIR, { recursive: true });
for (const name of readdirSync(CANDIDATES_DIR)) {
  if (!(name in EMPTY_CANDIDATE_FILES)) rmSync(join(CANDIDATES_DIR, name), { recursive: true, force: true });
}
for (const [name, contents] of Object.entries(EMPTY_CANDIDATE_FILES)) {
  writeFileSync(join(CANDIDATES_DIR, name), contents);
}
console.info(`Reset ${CANDIDATES_DIR}: no style candidates.`);
