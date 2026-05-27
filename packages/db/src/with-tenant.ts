// ADR 0048 — Tenant Context via `withTenant` wrapper
//
// Padrão obrigatório em Route Handlers tenant-aware do apps/web.
// Lock 6 (Global Identity) — User existe fora de tenant; Patient é tenant-scoped.
//
// CORREÇÃO QA #1 (CRÍTICO ZERO-DAY) — duas vulnerabilidades combinadas:
//   1. JWT era apenas base64-decoded SEM validar assinatura.
//   2. Valores extraídos iam para SQL via $executeRawUnsafe (template strings)
//      permitindo SQL injection trivial via header Authorization forjado.
//
// Mitigações desta versão:
//   - Token validado REMOTAMENTE via `supabase.auth.getUser(token)` —
//     elimina necessidade de SUPABASE_JWT_SECRET local. Compatível com
//     rotação de chaves Supabase (JWKS, HS→ES).
//   - UUID regex validation defense-in-depth nas claims.
//   - $executeRaw (tagged template) com parameter binding via $1/$2 — Postgres
//     trata como literal mesmo se a claim fosse hostile.

import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { prisma } from "./client";
import type { PrismaClient } from "./client";

// ── Tipos ────────────────────────────────────────────────────────────────

interface MinimalRequest {
  headers: { get(name: string): string | null };
  cookies: { get(name: string): { value: string } | undefined };
}

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface TenantContext {
  organizationId: string;
  userId: string;
  prisma: TxClient;
}

export class TenantContextError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message);
    this.name = "TenantContextError";
  }
}

// ── Validadores ──────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw new TenantContextError(`Invalid ${label} format`, 401);
  }
  return value;
}

// ── Validação JWT via Supabase Auth (remote) ─────────────────────────────

/**
 * Supabase client cacheado para validação de tokens.
 * Usa anon key (público) — o endpoint /auth/v1/user valida assinatura JWT
 * server-side e retorna user data se válido.
 */
let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient(): ReturnType<typeof createClient> {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new TenantContextError(
      "Server misconfigured: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing",
      500,
    );
  }
  _supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabase;
}

// ── B4 (QA Rodada 7): Cache de getUser(token) no Redis ───────────────────
//
// Cada validação remota custa ~50-150ms. Cacheando o resultado por 30s
// reduz para ~5ms quando o mesmo token é reusado dentro da janela.
//
// Key: sha256(token).slice(0,32) → não armazena token plain no Redis.
// Value: { sub, currentOrg } (claims mínimas).
// TTL: 30s — curto suficiente para refresh de revogações (logout, ban),
// longo suficiente para amortizar requests em rajada (página com 5+ Server
// Actions em paralelo).
//
// Fail-open: se Redis indisponível, fallback ao roundtrip Supabase.

const CACHE_TTL_SECONDS = 30;

let _redis: Redis | null = null;
let _redisProbed = false;

function getRedis(): Redis | null {
  if (_redisProbed) return _redis;
  _redisProbed = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

interface CachedAuth {
  sub: string;
  currentOrg: string;
}

async function getCachedAuth(token: string): Promise<CachedAuth | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key = `auth:user:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
    const cached = await redis.get<CachedAuth>(key);
    return cached;
  } catch {
    return null;
  }
}

async function setCachedAuth(token: string, value: CachedAuth): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = `auth:user:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
    await redis.set(key, value, { ex: CACHE_TTL_SECONDS });
  } catch {
    // ignore — cache best-effort
  }
}

/**
 * Extrai e VALIDA o JWT Supabase do request.
 *
 * Versão anterior fazia base64-decode do payload SEM verificar assinatura,
 * permitindo claims forjadas. Esta versão delega validação ao Supabase Auth
 * via getUser(token) — endpoint /auth/v1/user valida assinatura HS256/ES256/
 * JWKS automaticamente e retorna 401 se inválido.
 *
 * Trade-off: ~50-150ms de latência por request (network roundtrip).
 * Otimização futura: cache em Redis com TTL curto (5-15s).
 */
export async function extractTenantFromRequest(
  request: MinimalRequest,
): Promise<{ organizationId: string; userId: string }> {
  const authHeader = request.headers.get("authorization");
  // Cookies Supabase variam de nome — `sb-access-token` cobre legacy/tests.
  const cookieToken = request.cookies.get("sb-access-token")?.value;
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || cookieToken;

  if (!token) {
    throw new TenantContextError("Missing authentication token", 401);
  }

  // Fast path: cache Redis (TTL 30s). ~5ms vs ~100ms do roundtrip Supabase.
  const cached = await getCachedAuth(token);
  if (cached) {
    return {
      userId: assertUuid(cached.sub, "user.id (cached)"),
      organizationId: assertUuid(cached.currentOrg, "current_org (cached)"),
    };
  }

  // Slow path: validação REMOTA — Supabase rejeita JWT forjado/expirado.
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new TenantContextError(
      error?.message ?? "Invalid or expired token",
      401,
    );
  }

  const user = data.user;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const currentOrg = appMetadata.current_org;

  if (!currentOrg) {
    throw new TenantContextError(
      "No organization selected — call /api/auth/select-org first",
      403,
    );
  }

  // UUID validation defense-in-depth (Supabase já valida assinatura, mas
  // claims customizadas como app_metadata.current_org podem conter
  // qualquer formato — garantimos UUID antes de tocar SQL).
  const userId = assertUuid(user.id, "user.id");
  const organizationId = assertUuid(currentOrg, "current_org claim");

  // Cache para próximos requests (fire-and-forget; falha de cache não bloqueia).
  void setCachedAuth(token, { sub: userId, currentOrg: organizationId });

  return { organizationId, userId };
}

// ── Wrapper principal ────────────────────────────────────────────────────

/**
 * Wrapper para Route Handlers tenant-aware.
 *
 * Uso em apps/web/src/app/api/v1/{resource}/route.ts:
 *
 *   export async function GET(req: NextRequest) {
 *     return withTenant(req, async ({ prisma, organizationId }) => {
 *       const items = await prisma.patient.findMany();
 *       return NextResponse.json({ items });
 *     });
 *   }
 *
 * Pipeline:
 *   1. Valida JWT remotamente via Supabase (extrai org_id + user_id).
 *   2. Verifica Membership ATIVA na org.
 *   3. Inicia transação Prisma.
 *   4. Define GUCs app.current_org / app.current_user via PARAMETER BINDING.
 *   5. Chama handler com prisma transactional client. RLS automático.
 */
export async function withTenant<T>(
  request: MinimalRequest,
  handler: (ctx: TenantContext) => Promise<T>,
): Promise<T> {
  const { organizationId, userId } = await extractTenantFromRequest(request);

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { status: true, role: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new TenantContextError(
      "User does not have active membership in this organization",
      403,
    );
  }

  return prisma.$transaction(async (tx) => {
    // CORREÇÃO: $executeRaw (tagged template) faz parameter binding via $1/$2.
    // Mesmo que organizationId fosse hostile, Postgres trata como literal.
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}::text, ${true}::boolean)`;
    await tx.$executeRaw`SELECT set_config('app.current_user', ${userId}::text, ${true}::boolean)`;
    return handler({ organizationId, userId, prisma: tx });
  });
}

/**
 * Variante para workers internos onde já temos org/user resolvidos de outra
 * fonte autoritativa (DB join, fila com tenant scope, etc).
 *
 * ATENÇÃO: Caller é responsável por garantir que os UUIDs vieram de fonte
 * confiável (não de input direto de cliente). Nunca passe valores que
 * trafegaram sem validação.
 */
export async function withTenantUnsafe<T>(
  organizationId: string,
  userId: string,
  handler: (ctx: TenantContext) => Promise<T>,
): Promise<T> {
  assertUuid(organizationId, "organizationId");
  assertUuid(userId, "userId");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}::text, ${true}::boolean)`;
    await tx.$executeRaw`SELECT set_config('app.current_user', ${userId}::text, ${true}::boolean)`;
    return handler({ organizationId, userId, prisma: tx });
  });
}
