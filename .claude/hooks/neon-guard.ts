#!/usr/bin/env node
// PreToolUse hook for the Neon MCP (matcher: mcp__[Nn]eon__.*). Node 24 runs this TypeScript
// directly (type stripping). Policy lives in neon-guard-policy.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decide, type ProjectInfo } from "./neon-guard-policy.ts";

type HookInput = { tool_name?: string; tool_input?: Record<string, unknown> };

const raw = readFileSync(0, "utf8");
const payload = JSON.parse(raw || "{}") as HookInput;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let project: ProjectInfo;
try {
  project = JSON.parse(readFileSync(join(projectDir, "neon.project.json"), "utf8")) as ProjectInfo;
} catch {
  // Without project info we can't tell production apart: fail closed for anything but reads.
  project = { projectId: "unknown", productionBranch: { name: "main", id: "unknown" }, devBranch: "dev" };
}

const result = decide(payload.tool_name ?? "", payload.tool_input ?? {}, project);
if (result.decision !== "allow") {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: result.decision,
        permissionDecisionReason: `[neon-guard] ${result.reason ?? ""}`,
      },
    }),
  );
}
process.exit(0);
