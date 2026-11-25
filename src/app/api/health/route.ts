import { connection } from "next/server";
import { db } from "@/lib/db";

/** Liveness + database check for uptime monitors and post-deploy smoke tests. Never cached. */
export async function GET() {
  await connection();
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - started, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", db: "unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
