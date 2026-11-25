import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { decide, isReadOnlySql, type ProjectInfo } from "../../.claude/hooks/neon-guard-policy";

const project: ProjectInfo = {
  projectId: "proj-1",
  productionBranch: { name: "main", id: "br-prod" },
  devBranch: "dev",
};

describe("isReadOnlySql", () => {
  it.each([
    "select 1",
    "SELECT * FROM \"Task\" WHERE title = 'drop table x'",
    "with t as (select 1) select * from t",
    'explain select * from "Task"',
    "-- comment\nselect now();",
  ])("treats %j as read-only", (sql) => expect(isReadOnlySql(sql)).toBe(true));

  it.each([
    'delete from "Task"',
    'select 1; drop table "Task"',
    'with gone as (delete from "Task" returning *) select * from gone',
    'select * into backup from "Task"',
    "update \"Task\" set title = 'x'",
    "select setval('seq', 1)",
    "",
  ])("treats %j as a write", (sql) => expect(isReadOnlySql(sql)).toBe(false));
});

describe("decide", () => {
  it("allows reads anywhere", () => {
    expect(decide("mcp__Neon__describe_table_schema", { branchId: "br-prod" }, project).decision).toBe("allow");
    expect(decide("mcp__Neon__run_sql", { sql: 'select count(*) from "Task"' }, project).decision).toBe("allow");
  });

  it("denies writes on production, including when no branch is given", () => {
    expect(decide("mcp__Neon__run_sql", { sql: 'delete from "Task"', branchId: "br-prod" }, project).decision).toBe(
      "deny",
    );
    expect(decide("mcp__Neon__run_sql", { sql: 'delete from "Task"' }, project).decision).toBe("deny");
    expect(decide("mcp__Neon__run_sql", { sql: 'delete from "Task"', branchId: "main" }, project).decision).toBe(
      "deny",
    );
    expect(
      decide("mcp__Neon__run_sql_transaction", { sqlStatements: ["select 1", "drop table x"] }, project).decision,
    ).toBe("deny");
  });

  it("allows writes on dev / preview / test branches", () => {
    expect(decide("mcp__Neon__run_sql", { sql: 'delete from "Task"', branchId: "br-dev" }, project).decision).toBe(
      "allow",
    );
    expect(decide("mcp__neon__reset_from_parent", { branchIdOrName: "preview/feat-x" }, project).decision).toBe(
      "allow",
    );
  });

  it("never lets Neon apply migrations: they ship as Prisma files in a PR", () => {
    expect(decide("mcp__Neon__complete_database_migration", { branchId: "br-dev" }, project).decision).toBe("deny");
    expect(decide("mcp__Neon__prepare_database_migration", {}, project).decision).toBe("deny");
  });

  it("protects production and dev from destructive branch operations", () => {
    expect(decide("mcp__Neon__delete_branch", { branchId: "br-prod" }, project).decision).toBe("deny");
    expect(decide("mcp__Neon__reset_from_parent", {}, project).decision).toBe("deny");
    expect(decide("mcp__Neon__delete_branch", { branchId: "dev" }, project).decision).toBe("ask");
  });

  it("asks for project-level and unknown tools, and denies other projects", () => {
    expect(decide("mcp__Neon__delete_project", { projectId: "proj-1" }, project).decision).toBe("ask");
    expect(decide("mcp__Neon__brand_new_tool", { branchId: "br-dev" }, project).decision).toBe("ask");
    expect(decide("mcp__Neon__run_sql", { projectId: "other", sql: "select 1", branchId: "x" }, project).decision).toBe(
      "deny",
    );
  });
});

describe("hook entrypoint", () => {
  it("emits a deny decision Claude Code understands", () => {
    const out = execFileSync("node", [".claude/hooks/neon-guard.ts"], {
      input: JSON.stringify({ tool_name: "mcp__Neon__run_sql", tool_input: { sql: 'drop table "Task"' } }),
      encoding: "utf8",
    });
    expect(JSON.parse(out).hookSpecificOutput).toMatchObject({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
    });
  });

  it("stays silent (normal permission flow) for allowed calls", () => {
    const out = execFileSync("node", [".claude/hooks/neon-guard.ts"], {
      input: JSON.stringify({ tool_name: "mcp__Neon__get_database_tables", tool_input: {} }),
      encoding: "utf8",
    });
    expect(out).toBe("");
  });
});
