// GET /api/health/db — anti-pausa Supabase Free
// v11.2 Diff B.6 — UPDATE + SELECT em _keepalive
// ADR 0044 — Cloudflare Workers Cron Trigger bate a cada 5 dias
//
// CORREÇÃO QA #98: rate limit per-IP — endpoint público faz UPDATE no DB
// a cada call. Atacante pode martelar gerando carga em produção. CF Worker
// legítimo faz 1 req a cada 5 dias; rate limit 60/h cobre folgadamente.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nutricore/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Rate limit: 60 req/h per-IP (CF Worker legítimo: 1/5 dias = ~0.0014/h)
  const limit = await checkRateLimit(req, "health:db:ip", {
    max: 60,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const start = Date.now();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // UPDATE garante write activity (read-only não previne pausa Supabase)
      await tx.$executeRaw`UPDATE _keepalive SET last_touched = now() WHERE id = 1`;
      const rows = await tx.$queryRaw<{ id: number; last_touched: Date }[]>`
        SELECT id, last_touched FROM _keepalive WHERE id = 1
      `;
      return rows[0];
    });

    // CORREÇÃO QA #90: NÃO expor latency_ms para clientes não-internos.
    // Latência é side-channel para timing attacks + reconnaissance de carga.
    // CF Worker legítimo não precisa do número exato; apenas status.
    const _latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        last_touched: result?.last_touched?.toISOString(),
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    // CORREÇÃO QA: não vazar mensagem de erro do DB (pode revelar schema/versão)
    console.error("[health/db]", err);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
