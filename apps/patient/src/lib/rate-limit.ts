// Rate limit helper — Upstash Ratelimit + Redis (idêntico ao apps/web/lib).
//
// CORREÇÃO QA #12 — proteger /auth/accept-invite contra brute force e spam.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

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

export function getClientId(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
  scope: string;
}

export async function checkRateLimit(
  req: NextRequest,
  scope: string,
  opts: { max: number; windowSec: number; identifier?: string },
): Promise<RateLimitResult> {
  const limiter = getLimiter(scope, opts.max, opts.windowSec);
  if (!limiter) {
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
