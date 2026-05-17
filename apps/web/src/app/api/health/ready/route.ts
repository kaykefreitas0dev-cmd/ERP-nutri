// GET /api/health/ready — readiness probe (checa deps externas)
// Diferente de /live: pode retornar 503 se DB/Redis estão down

import { NextResponse } from "next/server";
import { prisma } from "@nutricore/db";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  status: "ok" | "error" | "skipped";
  latency_ms?: number;
  error?: string;
}

async function checkDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return { status: "skipped" };
  }

  const start = Date.now();
  try {
    const redis = new Redis({ url, token });
    await redis.ping();
    return { status: "ok", latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown",
    };
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const overall =
    db.status === "ok" && (redis.status === "ok" || redis.status === "skipped")
      ? "ready"
      : "not_ready";

  const httpStatus = overall === "ready" ? 200 : 503;

  return NextResponse.json(
    {
      status: overall,
      checks: { db, redis },
      timestamp: new Date().toISOString(),
    },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
