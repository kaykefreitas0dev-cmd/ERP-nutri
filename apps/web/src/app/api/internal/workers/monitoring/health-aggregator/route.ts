/**
 * POST /api/internal/workers/monitoring/health-aggregator
 *
 * Worker invocado por CF Worker Cron (5min) ou QStash schedule.
 * Checa cada dependência e faz UPSERT em service_health.
 * A status page pública (/api/public/status) lê dessa tabela.
 *
 * Proteção:
 *   - QStash signature (se QSTASH_CURRENT_SIGNING_KEY presente)
 *   - OU header X-Internal-Token === INTERNAL_HEALTH_TOKEN (CF Worker)
 *   - Em dev sem nenhum dos dois → permite (degraded)
 *
 * v11.2 Diff B.7 — substitui QStash 60s por CF Worker (não estoura free tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nutricore/db";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServiceStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage";

interface Check {
  serviceKey: string;
  status: ServiceStatus;
  latencyMs: number | null;
  message: string | null;
}

// ── Auth do worker ────────────────────────────────────────────────────────
async function isAuthorized(
  req: NextRequest,
  rawBody: string,
): Promise<boolean> {
  // 1. Internal token (CF Worker)
  const internalToken = process.env.INTERNAL_HEALTH_TOKEN;
  if (internalToken) {
    const provided = req.headers.get("x-internal-token");
    if (provided && provided === internalToken) return true;
  }

  // 2. QStash signature
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (currentKey && nextKey) {
    try {
      const { Receiver } = await import("@upstash/qstash");
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      });
      const signature = req.headers.get("upstash-signature") ?? "";
      await receiver.verify({ signature, body: rawBody });
      return true;
    } catch {
      // signature inválida
    }
  }

  // 3. Dev fallback (nenhum mecanismo configurado)
  if (!internalToken && !currentKey) {
    return process.env.NODE_ENV !== "production";
  }

  return false;
}

// ── Checks individuais ──────────────────────────────────────────────────────
async function checkDatabase(): Promise<Check> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return {
      serviceKey: "database",
      status: latencyMs > 1000 ? "degraded" : "operational",
      latencyMs,
      message: null,
    };
  } catch {
    return {
      serviceKey: "database",
      status: "major_outage",
      latencyMs: Date.now() - start,
      message: "Connection failed",
    };
  }
}

async function checkStorage(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return {
      serviceKey: "storage",
      status: "operational",
      latencyMs: null,
      message: null,
    };
  }
  const start = Date.now();
  try {
    // Storage health: HEAD na API de storage (não precisa auth para health)
    const res = await fetch(`${url}/storage/v1/version`, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    return {
      serviceKey: "storage",
      status: res.ok
        ? latencyMs > 1500
          ? "degraded"
          : "operational"
        : "partial_outage",
      latencyMs,
      message: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch {
    return {
      serviceKey: "storage",
      status: "major_outage",
      latencyMs: Date.now() - start,
      message: "Unreachable",
    };
  }
}

async function checkEmail(): Promise<Check> {
  // Email: verifica apenas se o provider está configurado (não envia email real).
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSes = Boolean(process.env.AWS_SES_ACCESS_KEY_ID);
  if (!hasResend && !hasSes) {
    return {
      serviceKey: "email",
      status: "degraded",
      latencyMs: null,
      message: "No provider configured",
    };
  }
  return {
    serviceKey: "email",
    status: "operational",
    latencyMs: null,
    message: null,
  };
}

async function checkPayments(): Promise<Check> {
  // Payments: MVP usa EXTERNAL_RECORDED (sem rail). Asaas só em S22.
  // Status reflete se Asaas está configurado; senão "operational" (modo manual).
  const asaasKey = process.env.ASAAS_API_KEY;
  if (!asaasKey) {
    return {
      serviceKey: "payments",
      status: "operational",
      latencyMs: null,
      message: "Modo manual (EXTERNAL_RECORDED)",
    };
  }
  // Se Asaas configurado, poderia pingar. MVP: assume operational.
  return {
    serviceKey: "payments",
    status: "operational",
    latencyMs: null,
    message: null,
  };
}

// ── Redis check (extra, não está em service_health mas útil para log) ──────
async function checkRedis(): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; // skip
  try {
    const redis = new Redis({ url, token });
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await isAuthorized(req, rawBody))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Roda checks em paralelo (NÃO estão em transação Prisma — pool nativo, OK)
  const [db, storage, email, payments, redisOk] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkEmail(),
    checkPayments(),
    checkRedis(),
  ]);

  const checks: Check[] = [db, storage, email, payments];
  const observedAt = new Date();

  // UPSERT cada serviço. service_health não é tenant-scoped (leitura pública).
  // Usamos UPDATE por service_key (rows já existem do seed).
  let updated = 0;
  for (const c of checks) {
    try {
      await prisma.$executeRaw`
        UPDATE service_health
        SET status = ${c.status},
            latency_ms = ${c.latencyMs},
            message = ${c.message},
            observed_at = ${observedAt}
        WHERE service_key = ${c.serviceKey}
      `;
      updated++;
    } catch (err) {
      console.error(
        `[health-aggregator] failed to update ${c.serviceKey}:`,
        err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    observed_at: observedAt.toISOString(),
    checks: checks.map((c) => ({
      service: c.serviceKey,
      status: c.status,
      latency_ms: c.latencyMs,
    })),
    redis: redisOk ? "ok" : "error",
  });
}

// GET para permitir trigger manual + CF Worker que use GET (alguns crons só fazem GET)
export async function GET(req: NextRequest) {
  return POST(req);
}
