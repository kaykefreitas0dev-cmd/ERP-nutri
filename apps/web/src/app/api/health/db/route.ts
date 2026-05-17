// GET /api/health/db — anti-pausa Supabase Free
// v11.2 Diff B.6 — UPDATE + SELECT em _keepalive
// ADR 0044 — Cloudflare Workers Cron Trigger bate a cada 5 dias

import { NextResponse } from "next/server";
import { prisma } from "@nutricore/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

    const latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        last_touched: result?.last_touched?.toISOString(),
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[health/db]", err);
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
