"use server";

// CORREÇÃO QA Rodada 6: appendAuditLog helper.

import { z } from "zod";
import { headers } from "next/headers";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

const NpsSchema = z.object({
  score: z.number().int().min(0).max(10),
  comment: z
    .string()
    .trim()
    .max(800, "Comentário até 800 caracteres")
    .optional()
    .or(z.literal("")),
  context: z.string().max(120).optional(),
});

export interface NpsResult {
  ok: boolean;
  message?: string;
}

export async function submitNpsAction(input: {
  score: number;
  comment?: string;
  context?: string;
}): Promise<NpsResult> {
  const parsed = NpsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Entrada inválida",
    };
  }

  const h = await headers();
  const ua = h.get("user-agent") ?? null;

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      await tx.npsFeedback.create({
        data: {
          organizationId,
          userId,
          score: parsed.data.score,
          comment: parsed.data.comment?.trim() || null,
          context: parsed.data.context ?? null,
          userAgent: ua,
        },
      });

      // CORREÇÃO QA #80: appendAuditLog helper.
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        actorUserAgent: ua,
        action: "beta.nps_submit",
        entityType: "NpsFeedback",
        entityId: null,
        patientId: null,
        fieldsAccessed: ["score"],
        payload: { score: parsed.data.score },
      });
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    return {
      ok: false,
      message:
        err instanceof Error
          ? "Erro ao registrar feedback: " + err.message
          : "Erro ao registrar feedback",
    };
  }
}
