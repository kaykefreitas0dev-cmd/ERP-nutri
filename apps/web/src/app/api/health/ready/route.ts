// GET /api/health/ready — readiness probe (checa deps externas)
// Diferente de /live: pode retornar 503 se DB/Redis estão down
//
// CORREÇÃO QA Rodada 7:
//   - Rate limit per-IP (probes legítimos = 1/min; brute >120/min = abuse)
//   - Não vazar mensagens de erro de exception do DB/Redis (revela versão/schema)
//   - Não expor latency_ms para clientes não-autorizados (side-channel)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nutricore/db";
import { Redis } from "@upstash/redis";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  status: "ok" | "error" | "skipped";
}

async function checkDb(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (err) {
    console.error("[health/ready] db error:", err);
    return { status: "error" };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return { status: "skipped" };
  }

  try {
    const redis = new Redis({ url, token });
    await redis.ping();
    return { status: "ok" };
  } catch (err) {
    console.error("[health/ready] redis error:", err);
    return { status: "error" };
  }
}

export async function GET(req: NextRequest) {
  // Rate limit per-IP — probes legítimos (Vercel kubelet) 1/min; abuso 120+/min
  const limit = await checkRateLimit(req, "health:ready:ip", {
    max: 120,
    windowSec: 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

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
