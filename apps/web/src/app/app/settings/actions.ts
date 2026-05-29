"use server";

// CORREÇÃO QA Rodada 6: appendAuditLog helper.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

export interface SettingsResult {
  ok: boolean;
  message?: string;
}

const BrandingSchema = z.object({
  logoUrl: z.string().url().or(z.literal("")).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex válido (ex: #0F766E)"),
  emailFromName: z.string().min(2).max(80).trim(),
});

export async function updateBrandingAction(input: {
  logoUrl: string;
  primaryColor: string;
  emailFromName: string;
}): Promise<SettingsResult> {
  const parsed = BrandingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }

  try {
    await withTenantAction(async ({ tx, organizationId, userId, role }) => {
      // Apenas org_owner / clinic_admin podem editar branding
      if (role !== "org_owner" && role !== "clinic_admin") {
        throw new ActionTenantError(
          "Sem permissão pra editar branding",
          "FORBIDDEN",
        );
      }

      await tx.organizationBranding.upsert({
        where: { organizationId },
        update: {
          logoUrl: parsed.data.logoUrl || null,
          primaryColor: parsed.data.primaryColor,
          emailFromName: parsed.data.emailFromName,
        },
        create: {
          organizationId,
          logoUrl: parsed.data.logoUrl || null,
          primaryColor: parsed.data.primaryColor,
          emailFromName: parsed.data.emailFromName,
        },
      });

      // CORREÇÃO QA #83: appendAuditLog helper.
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "organization.update_branding",
        entityType: "OrganizationBranding",
        entityId: organizationId,
        patientId: null,
        fieldsAccessed: ["logoUrl", "primaryColor", "emailFromName"],
        payload: {},
      });
    });

    revalidatePath("/app/settings");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}
