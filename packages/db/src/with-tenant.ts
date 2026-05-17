// ADR 0048 — Tenant Context via `withTenant` wrapper
//
// Padrão obrigatório em Route Handlers tenant-aware do apps/web.
// Lock 6 (Global Identity) — User existe fora de tenant; Patient é tenant-scoped.
//
// Semgrep custom rule `no-route-without-with-tenant` enforça uso em CI.

import { prisma } from "./client";
import type { PrismaClient } from "./client";

// Tipo minimal — não importa NextRequest direto pra evitar conflito de
// versões de next no monorepo (pnpm pode instalar 2 paths .pnpm distintos
// quando há peer deps transitivas — ex: @playwright/test).
// Cobre o subset que withTenant precisa.
interface MinimalRequest {
  headers: {
    get(name: string): string | null;
  };
  cookies: {
    get(name: string): { value: string } | undefined;
  };
}
// Prisma 7 tem tipos complexos para tx client; usamos PrismaClient (subset funcional)
// Em runtime, o tx tem todos os métodos query + $executeRaw + $queryRaw
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

/**
 * Extrai organization_id e user_id do JWT Supabase do request.
 *
 * O JWT Supabase tem custom claim `app_metadata.current_org` injetado durante
 * /api/auth/select-org (após login). Sem essa claim → 401.
 */
export async function extractTenantFromRequest(
  request: MinimalRequest,
): Promise<{ organizationId: string; userId: string }> {
  const authHeader = request.headers.get("authorization");
  const cookieToken = request.cookies.get("sb-access-token")?.value;
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? cookieToken;

  if (!token) {
    throw new TenantContextError("Missing authentication token", 401);
  }

  // Decode JWT payload (validation acontece via Supabase Auth middleware)
  // Aqui apenas extraímos claims já validadas.
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new TenantContextError("Malformed JWT", 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
  } catch {
    throw new TenantContextError("Cannot decode JWT payload", 401);
  }

  const userId = payload.sub as string | undefined;
  const appMetadata = payload.app_metadata as
    | { current_org?: string }
    | undefined;
  const organizationId = appMetadata?.current_org;

  if (!userId) {
    throw new TenantContextError("JWT missing sub claim", 401);
  }
  if (!organizationId) {
    throw new TenantContextError(
      "No organization selected — call /api/auth/select-org first",
      403,
    );
  }

  return { organizationId, userId };
}

/**
 * Wrapper para Route Handlers tenant-aware.
 *
 * Uso em apps/web/src/app/api/v1/{resource}/route.ts:
 *
 *   import { withTenant } from "@nutricore/db/with-tenant";
 *
 *   export async function GET(req: NextRequest) {
 *     return withTenant(req, async ({ prisma, organizationId }) => {
 *       const items = await prisma.patient.findMany();
 *       return NextResponse.json({ items });
 *     });
 *   }
 *
 * O wrapper:
 * 1. Extrai org_id + user_id do JWT Supabase.
 * 2. Valida que o user tem Membership ATIVA na org.
 * 3. Inicia uma transação Prisma.
 * 4. Executa SET LOCAL app.current_org = $1 + app.current_user = $2.
 * 5. Chama o handler com prisma transactional client.
 * 6. RLS policies se ativam automaticamente baseadas nos GUCs.
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
    // SET LOCAL é transacional — não vaza entre transações
    // Use set_config(..., true) (LOCAL) em vez de SET LOCAL porque
    // `current_user` é palavra reservada do Postgres.
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_org', '${organizationId}', true)`,
    );
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user', '${userId}', true)`,
    );
    return handler({ organizationId, userId, prisma: tx });
  });
}

/**
 * Variante para casos onde precisamos do contexto mas SEM iniciar transação
 * (ex: streaming reads grandes, jobs internos).
 *
 * ATENÇÃO: usa connection com SET (não LOCAL) — connection-bound.
 * Deve ser usado apenas em workers internos, NUNCA em Route Handlers
 * que rodam em pool compartilhado.
 */
export async function withTenantUnsafe<T>(
  organizationId: string,
  userId: string,
  handler: (ctx: TenantContext) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Use set_config(..., true) (LOCAL) em vez de SET LOCAL porque
    // `current_user` é palavra reservada do Postgres.
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_org', '${organizationId}', true)`,
    );
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user', '${userId}', true)`,
    );
    return handler({ organizationId, userId, prisma: tx });
  });
}
