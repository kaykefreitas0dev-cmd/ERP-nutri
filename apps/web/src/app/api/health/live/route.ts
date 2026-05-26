// GET /api/health/live — kubelet-style liveness probe
// Retorna sempre 200 se o processo está respondendo (sem checar deps)
//
// CORREÇÃO QA #99: NÃO expor process.uptime() — reconnaissance window de
// deploys. Endpoint kubelet-style só precisa de 200 OK.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
