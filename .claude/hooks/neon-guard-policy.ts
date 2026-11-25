/**
 * Policy for Neon MCP calls (see docs/decisions/0003-db-safety-and-mcp-guard.md).
 * The hosted Neon MCP can be scoped to a project but not to a branch, so this hook enforces:
 *   - dev / preview / test branches: read and write
 *   - production branch: read-only SQL; no resets, deletes or Neon-applied migrations
 *   - schema changes ship only as Prisma migration files in a PR
 * Pure function so it can be unit-tested (tests/unit/neon-guard.test.ts).
 */

export type Decision = { decision: "allow" | "ask" | "deny"; reason?: string };
export type ProjectInfo = { projectId: string; productionBranch: { name: string; id: string }; devBranch: string };

const READ_ONLY_TOOLS = new Set([
  "list_projects",
  "list_shared_projects",
  "list_organizations",
  "describe_project",
  "describe_branch",
  "list_branch_computes",
  "get_database_tables",
  "describe_table_schema",
  "list_slow_queries",
  "compare_database_schema",
  "search",
  "fetch",
  "list_docs_resources",
  "get_doc_resource",
  "get_connection_string",
  "prepare_query_tuning",
]);

const SQL_TOOLS = new Set(["run_sql", "run_sql_transaction", "explain_sql_statement"]);
const PROD_FORBIDDEN_TOOLS = new Set([
  "delete_branch",
  "reset_from_parent",
  "provision_neon_auth",
  "complete_query_tuning",
]);
const ALWAYS_DENIED_TOOLS = new Set(["prepare_database_migration", "complete_database_migration"]);
const ASK_TOOLS = new Set(["create_project", "delete_project"]);
const BRANCH_CREATING_TOOLS = new Set(["create_branch"]);

const WRITE_KEYWORDS =
  /\b(insert|update|delete|merge|upsert|create|alter|drop|truncate|grant|revoke|comment|copy|vacuum|reindex|cluster|call|do|set|reset|lock|refresh|import|security|into|nextval|setval|pg_terminate_backend|pg_cancel_backend)\b/i;
const READ_START = /^\s*(select|with|explain|show|table|values)\b/i;

/** True when every statement is a plain read. Conservative: anything doubtful counts as a write. */
export function isReadOnlySql(sql: string): boolean {
  const stripped = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .trim();
  if (!stripped) return false;
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  return statements.length > 0 && statements.every((s) => READ_START.test(s) && !WRITE_KEYWORDS.test(s));
}

function branchRef(input: Record<string, unknown>): string | undefined {
  for (const key of ["branchId", "branchIdOrName", "branch", "branchName"]) {
    const value = input[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function sqlOf(input: Record<string, unknown>): string[] {
  if (typeof input.sql === "string") return [input.sql];
  if (Array.isArray(input.sqlStatements)) return input.sqlStatements.filter((s): s is string => typeof s === "string");
  return [];
}

export function decide(toolName: string, input: Record<string, unknown>, project: ProjectInfo): Decision {
  const tool = toolName.replace(/^mcp__neon__/i, "");

  if (typeof input.projectId === "string" && input.projectId !== project.projectId && !READ_ONLY_TOOLS.has(tool)) {
    return {
      decision: "deny",
      reason: `Neon project ${input.projectId} is not this app's project (${project.projectId}).`,
    };
  }
  if (READ_ONLY_TOOLS.has(tool) || BRANCH_CREATING_TOOLS.has(tool)) return { decision: "allow" };
  if (ASK_TOOLS.has(tool))
    return { decision: "ask", reason: `${tool} changes Neon projects. Confirm this is intended.` };
  if (ALWAYS_DENIED_TOOLS.has(tool)) {
    return {
      decision: "deny",
      reason:
        "Schema changes ship as Prisma migration files in a PR (applied to production by CI). Use the `migrate` skill: `pnpm db:migrate --name <change>` on the dev branch.",
    };
  }

  const ref = branchRef(input);
  // No branch given means Neon's default branch, which is production.
  const onProduction =
    ref === undefined || ref === project.productionBranch.id || ref === project.productionBranch.name;

  if (SQL_TOOLS.has(tool)) {
    if (!onProduction) return { decision: "allow" };
    const statements = sqlOf(input);
    if (statements.length > 0 && statements.every(isReadOnlySql)) return { decision: "allow" };
    return {
      decision: "deny",
      reason: `Production (${project.productionBranch.name}) is read-only for Claude. Pass branchId for the "${project.devBranch}" branch, or use a preview/test branch. Writes to production go through a reviewed migration.`,
    };
  }

  if (PROD_FORBIDDEN_TOOLS.has(tool)) {
    if (onProduction) {
      return {
        decision: "deny",
        reason: `${tool} is not allowed on the production branch (${project.productionBranch.name}).`,
      };
    }
    if (tool === "delete_branch" && ref === project.devBranch) {
      return { decision: "ask", reason: `This deletes the shared "${project.devBranch}" branch.` };
    }
    return { decision: "allow" };
  }

  return { decision: "ask", reason: `Unknown Neon MCP tool "${tool}": confirm it is safe for this branch.` };
}
