// ADR 0048 — Tenant Context via `withTenant` wrapper
//
// Padrão obrigatório em Route Handlers tenant-aware do apps/web.
// Lock 6 (Global Identity) — User existe fora de tenant; Patient é tenant-scoped.
//
// Semgrep custom rule `no-route-without-with-tenant` enforça uso em CI.
//
// CORREÇÃO QA #1 (CRÍTICO ZERO-DAY):
//   Versão anterior decodificava o JWT sem validar assinatura E interpolava
//   `organizationId`/`userId` em SQL via $executeRawUnsafe → SQL injection
//   trivial via header `Authorization: Bearer <jwt_forjado>`.
//
//   Mitigações desta versão:
//   1. JWT validado com `jose.jwtVerify()` contra SUPABASE_JWT_SECRET.
//   2. UUID format validation (defense-in-depth).
//   3. Substituição de $executeRawUnsafe por $executeRaw (tagged template
//      do Prisma faz parameter binding via $1, $2 — 100% safe).

import { jwtVerify, errors as joseErrors } from "jose";
import { prisma } from "./client";
import type { PrismaClient } from "./client";

// ── Tipos ────────────────────────────────────────────────────────────────

interface MinimalRequest {
  headers: { get(name: string): string | null };
  cookies: { get(name: string): { value: string } | undefined };
}

// Prisma 7 tx client (subset funcional, exclui métodos de gestão de conexão)
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface TenantContext {
  organizationId: string;
  userId: string;
  /**
   * Prisma transaction client com SET LOCAL app.current_org/app.current_user já aplicados.
   * Use APENAS este client dentro do handler (RLS depende).
   */
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

// UUID v1-v5 strict (lowercase hex). Defense-in-depth: mesmo que o JWT seja
// válido, se um claim vier malformado abortamos antes de tocar o DB.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw new TenantContextError(`Invalid ${label} format`, 401);
  }
  return value;
}

// JWT secret cached (lazy init para não quebrar em build-time sem env).
// `jose` HS256 aceita Uint8Array como chave — TextEncoder.encode é a
// forma canônica recomendada na doc oficial v5.
let _jwtKey: Uint8Array | null = null;

function getJwtKey(): Uint8Array {
  if (_jwtKey) return _jwtKey;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new TenantContextError(
      "Server misconfigured: SUPABASE_JWT_SECRET missing or too short",
      500,
    );
  }
  _jwtKey = new TextEncoder().encode(secret);
  return _jwtKey;
}

// ── Extração e validação do JWT ──────────────────────────────────────────

/**
 * Extrai e VALIDA o JWT Supabase do request.
 *
 * Versão anterior só fazia base64-decode do payload, permitindo um atacante
 * forjar claims arbitrárias. Esta versão:
 *   - Verifica assinatura HS256 contra SUPABASE_JWT_SECRET
 *   - Verifica claims `exp`, `iat`
 *   - Valida formato UUID de `sub` e `app_metadata.current_org`
 */
export async function extractTenantFromRequest(
  request: MinimalRequest,
): Promise<{ organizationId: string; userId: string }> {
  const authHeader = request.headers.get("authorization");
  // Cookies Supabase: nomes possíveis variam por versão do @supabase/ssr.
  // Em produção é `sb-<project-ref>-auth-token` (JSON-encoded em base64).
  // Mantemos `sb-access-token` por compat com testes/legacy.
  const cookieToken = request.cookies.get("sb-access-token")?.value;
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || cookieToken;

  if (!token) {
    throw new TenantContextError("Missing authentication token", 401);
  }

  // Verificar assinatura + claims padrão (exp, iat)
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, getJwtKey(), {
      // Supabase usa "authenticated" como audience para users logados
      // e algorithm HS256. Se isso mudar (ES256/JWKS), atualizar aqui.
      algorithms: ["HS256"],
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new TenantContextError("Token expired", 401);
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new TenantContextError("Invalid token signature", 401);
    }
    if (err instanceof TenantContextError) throw err; // re-lança erro de config
    throw new TenantContextError("Invalid token", 401);
  }

  const appMetadata = payload.app_metadata as
    | { current_org?: unknown }
    | undefined;
  const currentOrg = appMetadata?.current_org;

  if (!currentOrg) {
    throw new TenantContextError(
      "No organization selected — call /api/auth/select-org first",
      403,
    );
  }

  // UUID validation defense-in-depth (já validados pelo JWT signing,
  // mas se algum dia o claim virar parametrizado por user, não vaza).
  const userId = assertUuid(payload.sub, "JWT sub claim");
  const organizationId = assertUuid(currentOrg, "current_org claim");

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
 *   1. Valida JWT (assinatura + exp) e extrai org_id + user_id.
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

  // Validação de membership ativa
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
    // CORREÇÃO: $executeRaw (tagged template) faz parameter binding via $1, $2.
    // SQL gerado: SELECT set_config('app.current_org', $1, $2)
    // Mesmo que organizationId fosse hostile, o Postgres trata como literal.
    // O cast ::text é defensivo para evitar coerção inesperada.
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
  // UUID validation defense-in-depth — mesmo em uso interno.
  assertUuid(organizationId, "organizationId");
  assertUuid(userId, "userId");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}::text, ${true}::boolean)`;
    await tx.$executeRaw`SELECT set_config('app.current_user', ${userId}::text, ${true}::boolean)`;
    return handler({ organizationId, userId, prisma: tx });
  });
}
