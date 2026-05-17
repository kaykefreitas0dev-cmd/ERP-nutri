"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export interface InviteActionResult {
  ok: boolean;
  message?: string;
  inviteId?: string;
  inviteUrl?: string;
}

const INVITE_TTL_DAYS = 7;

function generateToken(): { plain: string; hash: string } {
  // 32 bytes = 256 bits de entropia — URL-safe base64
  const plain = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

function getPatientAppBaseUrl(): string {
  // Em produção: NEXT_PUBLIC_PATIENT_APP_URL aponta para app.${dominio}
  return (
    process.env.NEXT_PUBLIC_PATIENT_APP_URL ?? "https://patient.nutricore.app"
  );
}

const CreateInviteSchema = z.object({
  patientId: z.string().uuid(),
  email: z.string().email().max(254).trim(),
});

export async function createInviteAction(input: {
  patientId: string;
  email: string;
}): Promise<InviteActionResult> {
  const parsed = CreateInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Email inválido: " + parsed.error.issues[0]?.message,
    };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const patient = await tx.patient.findFirst({
          where: { id: parsed.data.patientId },
          select: { id: true, fullName: true, userId: true },
        });
        if (!patient) throw new Error("Paciente não encontrado");
        if (patient.userId) {
          throw new Error(
            "Este paciente já possui conta vinculada. Use a opção 'Reenviar acesso'.",
          );
        }

        // Revogar convites pendentes deste paciente (apenas 1 ativo por vez)
        await tx.patientInvite.updateMany({
          where: {
            patientId: patient.id,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            revokedAt: new Date(),
            revokedReason: "Novo convite gerado",
          },
        });

        const { plain, hash } = generateToken();
        const expiresAt = new Date(
          Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        const invite = await tx.patientInvite.create({
          data: {
            organizationId,
            patientId: patient.id,
            sentByUserId: userId,
            tokenHash: hash,
            email: parsed.data.email,
            expiresAt,
          },
        });

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'patient_invite.create'::text, 'PatientInvite'::text,
            ${invite.id}::text, ${patient.id}::uuid,
            ARRAY['email','expiresAt']::text[],
            ${JSON.stringify({ email: parsed.data.email })}::jsonb
          )
        `;

        return { invite, plain };
      },
    );

    const inviteUrl = `${getPatientAppBaseUrl()}/invite/${result.plain}`;
    revalidatePath(`/app/patients/${parsed.data.patientId}`);
    return {
      ok: true,
      inviteId: result.invite.id,
      inviteUrl,
    };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}

export async function revokeInviteAction(
  inviteId: string,
): Promise<InviteActionResult> {
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const inv = await tx.patientInvite.findFirst({
        where: { id: inviteId },
        select: { id: true, patientId: true, acceptedAt: true },
      });
      if (!inv) throw new Error("Convite não encontrado");
      if (inv.acceptedAt)
        throw new Error("Convite já aceito — não pode ser revogado");

      await tx.patientInvite.update({
        where: { id: inviteId },
        data: { revokedAt: new Date(), revokedReason: "Revogado manualmente" },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'patient_invite.revoke'::text, 'PatientInvite'::text,
          ${inviteId}::text, ${inv.patientId}::uuid,
          ARRAY['revokedAt']::text[],
          '{}'::jsonb
        )
      `;
    });
    return { ok: true, inviteId };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}
