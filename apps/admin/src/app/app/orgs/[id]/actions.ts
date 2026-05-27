"use server";

// CORREÇÃO QA Rodada 7 — apps/admin:
//   - UUID validation em orgId
//   - appendAuditLog helper em vez de raw $executeRaw (2 ocorrências)
//   - Sanitização de erros (não vazar internal DB messages)

import { revalidatePath } from "next/cache";
import { prisma } from "@nutricore/db";
import { appendAuditLog } from "@nutricore/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

async function ensureSuperAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const isSuperAdmin = Boolean(
    (user.app_metadata as Record<string, unknown> | undefined)?.[
      "is_super_admin"
    ],
  );
  return isSuperAdmin ? { userId: user.id } : null;
}

export async function suspendOrgAction(
  orgId: string,
  reason: string,
): Promise<AdminActionResult> {
  if (!orgId || !UUID_REGEX.test(orgId)) {
    return { ok: false, message: "orgId inválido" };
  }
  if (!reason || reason.trim().length < 5 || reason.length > 500) {
    return { ok: false, message: "Motivo obrigatório (5-500 chars)" };
  }
  const auth = await ensureSuperAdmin();
  if (!auth) return { ok: false, message: "Acesso negado" };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { subscriptionStatus: "SUSPENDED" },
      });
      if (!updated) throw new Error("Organização não encontrada");
    });
    // Audit fora da transação (já tem advisory lock próprio)
    await appendAuditLog({
      organizationId: orgId,
      actorUserId: auth.userId,
      actorRole: "super_admin",
      action: "organization.suspend",
      entityType: "Organization",
      entityId: orgId,
      patientId: null,
      fieldsAccessed: ["subscriptionStatus"],
      payload: { reason: reason.trim() },
    });
    revalidatePath(`/app/orgs/${orgId}`);
    revalidatePath("/app/orgs");
    return { ok: true };
  } catch (err) {
    console.error("[admin/suspendOrg]", err);
    return { ok: false, message: "Falha ao suspender organização" };
  }
}

export async function reactivateOrgAction(
  orgId: string,
): Promise<AdminActionResult> {
  if (!orgId || !UUID_REGEX.test(orgId)) {
    return { ok: false, message: "orgId inválido" };
  }
  const auth = await ensureSuperAdmin();
  if (!auth) return { ok: false, message: "Acesso negado" };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { subscriptionStatus: "ACTIVE" },
      });
      if (!updated) throw new Error("Organização não encontrada");
    });
    await appendAuditLog({
      organizationId: orgId,
      actorUserId: auth.userId,
      actorRole: "super_admin",
      action: "organization.reactivate",
      entityType: "Organization",
      entityId: orgId,
      patientId: null,
      fieldsAccessed: ["subscriptionStatus"],
      payload: {},
    });
    revalidatePath(`/app/orgs/${orgId}`);
    revalidatePath("/app/orgs");
    return { ok: true };
  } catch (err) {
    console.error("[admin/reactivateOrg]", err);
    return { ok: false, message: "Falha ao reativar organização" };
  }
}
