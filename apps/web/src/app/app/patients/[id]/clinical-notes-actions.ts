"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

const CreateNoteSchema = z.object({
  patientId: z.string().uuid(),
  content: z.string().min(1).max(20000),
  category: z.enum(["evolution", "anamnesis", "assessment", "plan"]).default("evolution"),
  consultationDate: z.string().optional(), // ISO
});

export interface NoteActionResult {
  ok: boolean;
  message?: string;
  noteId?: string;
}

export async function createClinicalNoteAction(
  formData: FormData,
): Promise<NoteActionResult> {
  const raw = {
    patientId: formData.get("patientId"),
    content: formData.get("content"),
    category: formData.get("category") ?? "evolution",
    consultationDate: formData.get("consultationDate") || undefined,
  };

  const parsed = CreateNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos" };
  }
  const data = parsed.data;
  const preview = data.content.slice(0, 60);

  try {
    const created = await withTenantAction(async ({ tx, organizationId, userId }) => {
      // Encrypt via SQL (envelope encryption)
      // Vault DEK criada on-demand para a org se não existir
      // (TODO: mover para ensureOrgDek call em onboarding completeAction)
      const encrypted = await tx.$queryRaw<{ encrypted: Buffer }[]>`
        SELECT phi.encrypt_for_org(${data.content}, ${organizationId}::uuid) AS encrypted
      `;

      if (!encrypted[0]?.encrypted) {
        throw new Error("Falha ao criptografar — DEK pode não estar configurada para esta org");
      }

      const note = await tx.clinicalNote.create({
        data: {
          organizationId,
          patientId: data.patientId,
          authorUserId: userId,
          encryptedContent: encrypted[0].encrypted,
          contentPreview: preview,
          category: data.category,
          consultationDate: data.consultationDate
            ? new Date(data.consultationDate)
            : new Date(),
        },
      });

      // Audit log: criação PHI
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet, NULL::text,
          'clinical_note.create'::text,
          'ClinicalNote'::text,
          ${note.id}::text,
          ${data.patientId}::uuid,
          ARRAY['encryptedContent']::text[],
          '{}'::jsonb
        )
      `;

      return note;
    });

    revalidatePath(`/app/patients/${data.patientId}`);
    return { ok: true, noteId: created.id };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[clinical-note/create]", msg);
    return {
      ok: false,
      message:
        msg.includes("DEK")
          ? "Criptografia não configurada para esta organização. Entre em contato com suporte."
          : "Erro ao salvar anotação clínica",
    };
  }
}

export async function listClinicalNotesAction(patientId: string): Promise<
  Array<{
    id: string;
    contentPreview: string | null;
    category: string;
    consultationDate: Date;
    createdAt: Date;
  }>
> {
  try {
    return await withTenantAction(async ({ tx, organizationId, userId }) => {
      const notes = await tx.clinicalNote.findMany({
        where: { patientId },
        orderBy: { consultationDate: "desc" },
        take: 50,
        select: {
          id: true,
          contentPreview: true,
          category: true,
          consultationDate: true,
          createdAt: true,
        },
      });

      // Audit: leitura da LISTA (sem descriptografar conteúdo ainda)
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet, NULL::text,
          'clinical_note.list'::text,
          'ClinicalNote'::text,
          NULL,
          ${patientId}::uuid,
          ARRAY['preview']::text[],
          '{}'::jsonb
        )
      `;

      return notes;
    });
  } catch (err) {
    console.error("[clinical-notes/list]", err);
    return [];
  }
}

export async function readClinicalNoteAction(
  noteId: string,
): Promise<{ ok: boolean; content?: string; message?: string }> {
  try {
    return await withTenantAction(async ({ tx, organizationId, userId }) => {
      const note = await tx.clinicalNote.findFirst({
        where: { id: noteId },
        select: {
          id: true,
          patientId: true,
          encryptedContent: true,
        },
      });

      if (!note) return { ok: false, message: "Nota não encontrada" };

      const decrypted = await tx.$queryRaw<{ content: string | null }[]>`
        SELECT phi.decrypt_for_org(${note.encryptedContent}::bytea, ${organizationId}::uuid) AS content
      `;

      // Audit DETALHADO de leitura PHI
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet, NULL::text,
          'clinical_note.read.content'::text,
          'ClinicalNote'::text,
          ${noteId}::text,
          ${note.patientId}::uuid,
          ARRAY['encryptedContent.decrypted']::text[],
          '{}'::jsonb
        )
      `;

      return {
        ok: true,
        content: decrypted[0]?.content ?? "(conteúdo não pôde ser descriptografado)",
      };
    });
  } catch (err) {
    console.error("[clinical-note/read]", err);
    return { ok: false, message: "Erro ao descriptografar" };
  }
}
