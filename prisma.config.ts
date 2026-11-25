// Prisma 7 CLI config. Prisma 7 does not load .env files itself, so load them here.
// The CLI (migrate, seed, studio) uses the DIRECT (unpooled) Neon URL: PgBouncer's
// transaction mode breaks migration advisory locks. The app runtime uses the pooled
// DATABASE_URL through the Neon adapter (src/lib/db.ts).
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // process.env (not env()) so `prisma generate` works in CI/builds without a database.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
