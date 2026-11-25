# 0001: Pin Prisma to 7.x

Date: 2026-11-24 · Status: accepted

**Context.** npm's `latest` tag for `prisma` points at 8.0.0-rc.x. Prisma's own release-status
page calls 8 a release candidate. Prisma 8 replaces the query API (`db.orm.public.User.where(...)`),
removes `@prisma/client`/`prisma generate`, and renames migrate commands. The libraries' stable line
is 7.10.x, and Neon's Prisma guide targets 7.

**Decision.** Use Prisma 7.10.x with the Rust-free `prisma-client` generator, `prisma.config.ts`
(the CLI uses the direct URL), and `@prisma/adapter-neon` at runtime (pooled URL). Pin exact versions.
Renovate allows only `<8`.

**Consequences.** Ignore the CLI's "update to 8" banner. Moving to 8 is a planned migration
(new query API across every `data.ts`), to be done once 8 is GA and Neon's docs cover it.
