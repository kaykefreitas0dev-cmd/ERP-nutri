"use server";

// CORREÇÃO QA Rodada 4:
//   #49 — rate limit per-user (10 convites / hora) para conter spam SES.
//   #50+#51 — explicit organizationId no findFirst (defense-in-depth).
//   #52 — appendAuditLog helper em vez de raw $executeRaw.
//   #53 — UUID validation em revokeInviteAction.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { sendPatientInviteEmail } from "@/lib/email/send-invite";
import { appendAuditLog } from "@nutricore/db/audit";
import { checkRateLimitById } from "@/lib/rate-limit";

export interface InviteActionResult {
  ok: boolean;
  message?: string;
  inviteId?: string;
  inviteUrl?: string;
  /** true se email foi enviado automaticamente via provider configurado */
  emailSent?: boolean;
  /** email do destinatário (echo back para UX) */
  emailTo?: string;
}

const INVITE_TTL_DAYS = 7;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function getRateLimitIdentifier(userId: string): Promise<string> {
  // userId é o melhor identificador (resistente a IP shifting).
  return `user:${userId}`;
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
        // CORREÇÃO QA #49: rate limit per-user — 10 convites/hora.
        // Previne spam SES + DB bloat com tokens órfãos.
        const identifier = await getRateLimitIdentifier(userId);
        const limit = await checkRateLimitById(
          "invite:create:user",
          identifier,
          { max: 10, windowSec: 3600 },
        );
        if (!limit.ok) {
          throw new Error(
            "Limite de 10 convites/hora atingido. Aguarde antes de criar mais.",
          );
        }

        // CORREÇÃO QA #50: organizationId explícito.
        const patient = await tx.patient.findFirst({
          where: { id: parsed.data.patientId, organizationId },
          select: { id: true, fullName: true, userId: true },
        });
        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");
        if (patient.userId) {
          throw new Error(
            "Este paciente já possui conta vinculada. Use a opção 'Reenviar acesso'.",
          );
        }

        const org = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });

        // Revogar convites pendentes deste paciente (apenas 1 ativo por vez)
        await tx.patientInvite.updateMany({
          where: {
            patientId: patient.id,
            organizationId,
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

        // CORREÇÃO QA #52: appendAuditLog helper.
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "patient_invite.create",
          entityType: "PatientInvite",
          entityId: invite.id,
          patientId: patient.id,
          fieldsAccessed: ["email", "expiresAt"],
          // Não inclui email no payload do audit (PII; já vai em fieldsAccessed)
          payload: { ttlDays: INVITE_TTL_DAYS },
        });

        return { invite, plain, patient, org };
      },
    );

    const inviteUrl = `${getPatientAppBaseUrl()}/invite/${result.plain}`;

    // Best-effort: enviar email via Resend se configurado. Falha não bloqueia
    // — nutri sempre tem fallback para copiar URL manualmente.
    let emailSent = false;
    try {
      const sendResult = await sendPatientInviteEmail({
        to: parsed.data.email,
        patientFullName: result.patient.fullName,
        organizationName: result.org?.name ?? "Sua nutricionista",
        inviteUrl,
        expiresAt: result.invite.expiresAt,
      });
      emailSent = sendResult.ok;
    } catch (emailErr) {
      // log apenas — não bloqueia
      console.error("[invite-email] falhou:", emailErr);
    }

    revalidatePath(`/app/patients/${parsed.data.patientId}`);
    return {
      ok: true,
      inviteId: result.invite.id,
      inviteUrl,
      emailSent,
      emailTo: parsed.data.email,
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
  // CORREÇÃO QA #53: validar UUID antes de qualquer query.
  if (!inviteId || !UUID_REGEX.test(inviteId)) {
    return { ok: false, message: "inviteId inválido" };
  }

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      // CORREÇÃO QA #51: organizationId explícito.
      const inv = await tx.patientInvite.findFirst({
        where: { id: inviteId, organizationId },
        select: { id: true, patientId: true, acceptedAt: true },
      });
      if (!inv) throw new Error("Convite não encontrado nesta organização");
      if (inv.acceptedAt)
        throw new Error("Convite já aceito — não pode ser revogado");

      await tx.patientInvite.update({
        where: { id: inviteId },
        data: { revokedAt: new Date(), revokedReason: "Revogado manualmente" },
      });

      // CORREÇÃO QA #52: appendAuditLog helper.
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "patient_invite.revoke",
        entityType: "PatientInvite",
        entityId: inviteId,
        patientId: inv.patientId,
        fieldsAccessed: ["revokedAt"],
        payload: {},
      });
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
