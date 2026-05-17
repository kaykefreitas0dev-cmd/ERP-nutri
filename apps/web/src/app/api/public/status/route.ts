// GET /api/public/status — Status page público
// v11.2 Diff B.7 — lê service_health populado por worker monitoring.health-aggregator
// v11.2 Diff B.8 — usa public_label (oculta nomes dos providers)
//
// Cache CDN 60s para reduzir carga

import { NextResponse } from "next/server";
import { prisma } from "@nutricore/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ServiceStatus {
  label: string;
  status: "operational" | "degraded" | "partial_outage" | "major_outage";
  observed_at: string;
  latency_ms: number | null;
}

export async function GET() {
  try {
    // Pega o status mais recente de cada serviço (last observed)
    const rows = await prisma.$queryRaw<
      {
        service_key: string;
        public_label: string;
        status: string;
        latency_ms: number | null;
        observed_at: Date;
      }[]
    >`
      SELECT DISTINCT ON (service_key)
        service_key, public_label, status, latency_ms, observed_at
      FROM service_health
      ORDER BY service_key, observed_at DESC
    `;

    const services: ServiceStatus[] = rows.map((r) => ({
      label: r.public_label,
      status: r.status as ServiceStatus["status"],
      observed_at: r.observed_at.toISOString(),
      latency_ms: r.latency_ms,
    }));

    const overall = services.every((s) => s.status === "operational")
      ? "operational"
      : services.some((s) => s.status === "major_outage")
        ? "major_outage"
        : "degraded";

    return NextResponse.json(
      {
        status: overall,
        services,
        last_check: services[0]?.observed_at ?? null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      },
    );
  } catch (err) {
    // Se a query falha, retorna estado degradado (não 500 — não queremos status page caindo)
    console.error("[public/status]", err);
    return NextResponse.json(
      {
        status: "unknown",
        services: [],
        error: "Status check unavailable",
      },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60" },
      },
    );
  }
}
