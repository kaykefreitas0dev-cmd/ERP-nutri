// Cloudflare Worker — Healthcheck Supabase Keepalive
// ADR 0044 — Anti-pausa Supabase Free via Cloudflare Workers Cron Trigger

interface Env {
  HEALTH_URL: string; // https://erp-nutri-web.vercel.app/api/health/db
  ENVIRONMENT: "development" | "production";
  SENTRY_DSN?: string;
  // health-aggregator (status page): popula service_health
  AGGREGATOR_URL?: string; // https://erp-nutri-web.vercel.app/api/internal/workers/monitoring/health-aggregator
  INTERNAL_HEALTH_TOKEN?: string;
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // 1. Disparar health-aggregator (popula status page) — best-effort
    if (env.AGGREGATOR_URL && env.INTERNAL_HEALTH_TOKEN) {
      try {
        const aggRes = await fetch(env.AGGREGATOR_URL, {
          method: "POST",
          headers: {
            "X-Internal-Token": env.INTERNAL_HEALTH_TOKEN,
            "User-Agent": "NutriCore-CFWorker-HealthAggregator/1.0",
          },
          signal: AbortSignal.timeout(15_000),
        });
        console.log(
          JSON.stringify({
            level: aggRes.ok ? "info" : "error",
            msg: "[health-aggregator] triggered",
            status: aggRes.status,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (err) {
        console.error(
          "[health-aggregator] failed:",
          err instanceof Error ? err.message : "?",
        );
      }
    }

    // 2. Keepalive Supabase (anti-pausa)
    if (!env.HEALTH_URL) {
      console.error("[health-keepalive] HEALTH_URL not configured");
      return;
    }

    const start = Date.now();

    try {
      const response = await fetch(env.HEALTH_URL, {
        method: "GET",
        headers: {
          "User-Agent": "NutriCore-CFWorker-HealthKeepalive/1.0",
          "X-Source": "cloudflare-cron",
        },
        signal: AbortSignal.timeout(15_000),
      });

      const latency = Date.now() - start;
      const body = await response.text();

      console.log(
        JSON.stringify({
          level: response.ok ? "info" : "error",
          msg: "[health-keepalive] check",
          url: env.HEALTH_URL,
          status: response.status,
          latency_ms: latency,
          body_preview: body.slice(0, 200),
          timestamp: new Date().toISOString(),
        }),
      );

      if (!response.ok && env.SENTRY_DSN) {
        // Best-effort Sentry alert (sem SDK pra evitar peso)
        await fetch(env.SENTRY_DSN, {
          method: "POST",
          body: JSON.stringify({
            message: `[health-keepalive] /api/health/db returned ${response.status}`,
            level: "error",
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => undefined);
      }
    } catch (err) {
      const latency = Date.now() - start;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "[health-keepalive] failed",
          url: env.HEALTH_URL,
          error: err instanceof Error ? err.message : "Unknown",
          latency_ms: latency,
        }),
      );

      if (env.SENTRY_DSN) {
        await fetch(env.SENTRY_DSN, {
          method: "POST",
          body: JSON.stringify({
            message: `[health-keepalive] fetch failed: ${err instanceof Error ? err.message : "?"}`,
            level: "error",
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => undefined);
      }
    }
  },

  // Fetch handler para debugging manual (rodar via wrangler tail)
  async fetch(_request: Request, env: Env): Promise<Response> {
    return new Response(
      JSON.stringify({
        worker: "nutricore-health-keepalive",
        environment: env.ENVIRONMENT,
        next_scheduled: "Every 5 days at 06:00 UTC",
        target: env.HEALTH_URL,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  },
};
