# 0008: Agent tooling choices

Date: 2026-11-24 · Status: accepted

- `next-best-practices` (vercel-labs/next-skills) no longer exists. Vercel moved that knowledge into
  the docs bundled with Next.js and the generated `AGENTS.md` (imported by CLAUDE.md).
- Prisma skills: only `prisma-cli` and `prisma-client-api` (both Prisma 7). The setup skill targets Prisma 8 and was left out.
- The shadcn and Neon MCP servers are project-scoped in `.mcp.json`. The Vercel MCP comes with the Vercel plugin (`.claude/settings.json`).
- pnpm 12's `minimumReleaseAge` (1 day) stays on as supply-chain protection, and Renovate waits 3 days.
