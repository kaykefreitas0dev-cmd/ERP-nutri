// Rate limit helper para Server Actions públicos.
// Mirror de apps/{web,patient}/src/lib/rate-limit.ts.
//
// CORREÇÃO QA #27/#30 — proteger booking público contra spam/DoS.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `rl:${scope}`,
      analytics: true,
    });
    _limiters.set(key, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
  scope: string;
}

/**
 * Versão que recebe identifier direto (útil para Server Actions onde não
 * temos NextRequest disponível).
 */
export async function checkRateLimitById(
  scope: string,
  identifier: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const limiter = getLimiter(scope, max, windowSec);
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[rate-limit] FAIL-OPEN: Upstash not configured for scope "${scope}"`,
      );
    }
    return {
      ok: true,
      limit: max,
      remaining: max,
      reset: Date.now() + windowSec * 1000,
      scope,
    };
  }
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return { ok: success, limit, remaining, reset, scope };
}
