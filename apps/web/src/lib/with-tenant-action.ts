// Server Action wrapper que aplica tenant context (alternativa a withTenant para Route Handlers)
// Usado em Server Actions onde request não está disponível diretamente.

import { createSupabaseServerClient } from "./supabase/server";
import { prisma } from "@nutricore/db";

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
 * 1. Verifica sessão Supabase
 * 2. Determina organização ativa (memberships[0] por simplicidade — multi-org TODO)
 * 3. Abre transação Prisma + SET LOCAL app.current_org/app.current_user
 * 4. Chama handler com contexto
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

  return prisma.$transaction(async (tx) => {
    // Use set_config(..., true) (LOCAL) em vez de SET LOCAL porque
    // `current_user` é palavra reservada do Postgres e o parser confunde
    // mesmo quando prefixado com `app.`.
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_org', '${membership.organizationId}', true)`,
    );
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user', '${user.id}', true)`,
    );
    return handler({
      organizationId: membership.organizationId,
      userId: user.id,
      role: membership.role,
      tx,
    });
  });
}
