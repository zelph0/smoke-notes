import "server-only";
import { env } from "@/env";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./prisma";

// Reuse one client across hot reloads in dev; each serverless instance gets its own in prod.
// Pooled DATABASE_URL: safe for many short-lived serverless invocations.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient(env.DATABASE_URL);

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
