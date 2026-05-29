// Server Action wrapper que aplica tenant context (alternativa a withTenant para Route Handlers)
// Usado em Server Actions onde request não está disponível diretamente.
//
// CORREÇÃO QA #1: substitui $executeRawUnsafe (que era safe-by-source aqui,
// já que valores vêm de Supabase Auth + Prisma findFirst) por $executeRaw
// tagged template (parameter binding) + UUID validation defense-in-depth.
// Mantém safety se algum dia a fonte mudar.

import { createSupabaseServerClient } from "./supabase/server";
import { prisma } from "@nutricore/db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new ActionTenantError(`Invalid ${label} format`, "UNAUTHORIZED");
  }
}

export interface ActionTenantContext {
  organizationId: string;
  userId: string;
  role: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any; // Prisma transaction client
}

export class ActionTenantError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHORIZED" | "NO_ORG" | "FORBIDDEN",
  ) {
    super(message);
  }
}

/**
 * Wrapper para Server Actions tenant-aware.
 *
 * 1. Verifica sessão Supabase (validada server-side com cookie real).
 * 2. Determina organização ativa (memberships[0] — multi-org TODO).
 * 3. Valida UUID format (defense-in-depth).
 * 4. Abre transação Prisma + set_config via PARAMETER BINDING.
 * 5. Chama handler com contexto.
 */
export async function withTenantAction<T>(
  handler: (ctx: ActionTenantContext) => Promise<T>,
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ActionTenantError("Não autenticado", "UNAUTHORIZED");
  }

  // TODO: support multi-org com claim no JWT (current_org). MVP: pega primeira ativa.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    select: { organizationId: true, role: true },
  });

  if (!membership) {
    throw new ActionTenantError("Sem organização ativa", "NO_ORG");
  }

  // Defense-in-depth: validar UUID antes de qualquer SQL.
  assertUuid(user.id, "user.id");
  assertUuid(membership.organizationId, "membership.organizationId");

  return prisma.$transaction(async (tx) => {
    // CORREÇÃO: $executeRaw com tagged template usa parameter binding ($1, $2).
    // O cast ::text é defensivo contra coerção inesperada de tipos.
    await tx.$executeRaw`SELECT set_config('app.current_org', ${membership.organizationId}::text, ${true}::boolean)`;
    await tx.$executeRaw`SELECT set_config('app.current_user', ${user.id}::text, ${true}::boolean)`;
    return handler({
      organizationId: membership.organizationId,
      userId: user.id,
      role: membership.role,
      tx,
    });
  });
}
