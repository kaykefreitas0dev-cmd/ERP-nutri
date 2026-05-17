"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  if (!reason || reason.trim().length < 5) {
    return { ok: false, message: "Motivo obrigatório (mín 5 chars)" };
  }
  const auth = await ensureSuperAdmin();
  if (!auth) return { ok: false, message: "Acesso negado" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: { subscriptionStatus: "SUSPENDED" },
      });
      // Audit
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${orgId}::uuid, ${auth.userId}::uuid,
          'super_admin'::text, NULL::inet, NULL::text,
          'organization.suspend'::text, 'Organization'::text,
          ${orgId}::text, NULL::uuid,
          ARRAY['subscriptionStatus']::text[],
          ${JSON.stringify({ reason: reason.trim() })}::jsonb
        )
      `;
    });
    revalidatePath(`/app/orgs/${orgId}`);
    revalidatePath("/app/orgs");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function reactivateOrgAction(
  orgId: string,
): Promise<AdminActionResult> {
  const auth = await ensureSuperAdmin();
  if (!auth) return { ok: false, message: "Acesso negado" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: { subscriptionStatus: "ACTIVE" },
      });
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${orgId}::uuid, ${auth.userId}::uuid,
          'super_admin'::text, NULL::inet, NULL::text,
          'organization.reactivate'::text, 'Organization'::text,
          ${orgId}::text, NULL::uuid,
          ARRAY['subscriptionStatus']::text[],
          '{}'::jsonb
        )
      `;
    });
    revalidatePath(`/app/orgs/${orgId}`);
    revalidatePath("/app/orgs");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}
