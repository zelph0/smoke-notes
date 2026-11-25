import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client over the Neon serverless driver. App code uses the singleton in db.ts;
 * scripts (seed, test setup) call this directly because they run outside Next.js.
 */
export function createPrismaClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}
