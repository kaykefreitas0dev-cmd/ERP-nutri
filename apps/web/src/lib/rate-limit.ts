// Rate limit helper para Route Handlers — Upstash Ratelimit + Redis.
//
// Uso:
//   const limit = await checkRateLimit(req, "auth:signin", { max: 5, windowSec: 60 });
//   if (!limit.ok) return rateLimitResponse(limit);
//
// Se UPSTASH_REDIS_REST_URL/TOKEN não estiverem setados (dev sem Upstash),
// o rate limit DEGRADA-SE em fail-OPEN (passa tudo) — apropriado para dev,
// MAS em produção exige as envs (assert no boot via /api/health/ready).
//
// CORREÇÃO QA #2 — bloqueio de brute force em /api/auth/signin*.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

// Cache do client + dos limiters (evita recriar a cada request — serverless cold path).
let _redis: Redis | null = null;
const _limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

function getLimiter(
  scope: string,
  max: number,
  windowSec: number,
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${scope}:${max}:${windowSec}`;
  let limiter = _limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      // Sliding window: mais justo que fixed window contra burst-no-edge.
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `rl:${scope}`,
      analytics: true,
    });
    _limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Extrai um identificador estável do cliente para rate limit.
 * Ordem de preferência: x-forwarded-for[0] (Vercel/CF) > x-real-ip > "unknown".
 *
 * Nota: x-forwarded-for é confiável atrás de Vercel/Cloudflare (eles
 * sobrescrevem). Em proxy próprio, validar trust chain antes.
 */
export function getClientId(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
  scope: string;
}

/**
 * Checa o rate limit. Em ambiente sem Upstash configurado, retorna fail-open
 * com warning em console (para dev). Em prod, fail-OPEN é arriscado — verificar
 * em /api/health/ready que Redis está OK.
 */
export async function checkRateLimit(
  req: NextRequest,
  scope: string,
  opts: { max: number; windowSec: number; identifier?: string },
): Promise<RateLimitResult> {
  const limiter = getLimiter(scope, opts.max, opts.windowSec);

  if (!limiter) {
    // Fail-open em dev sem Upstash. Em prod, /api/health/ready deve gritar.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[rate-limit] FAIL-OPEN: Upstash not configured for scope "${scope}"`,
      );
    }
    return {
      ok: true,
      limit: opts.max,
      remaining: opts.max,
      reset: Date.now() + opts.windowSec * 1000,
      scope,
    };
  }

  const id = opts.identifier ?? getClientId(req);
  const { success, limit, remaining, reset } = await limiter.limit(id);
  return { ok: success, limit, remaining, reset, scope };
}

/**
 * Constrói resposta 429 padronizada com headers Retry-After + X-RateLimit-*.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: "rate_limited",
      message: "Too many requests. Please try again later.",
      scope: result.scope,
      retry_after_seconds: retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    },
  );
}
