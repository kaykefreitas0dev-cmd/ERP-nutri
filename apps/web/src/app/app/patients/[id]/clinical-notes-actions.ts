"use server";

// CORREÇÃO QA Rodada 5:
//   #69 — listClinicalNotesAction: UUID validation + org check
//   #70 — readClinicalNoteAction: UUID validation + org check
//   #71 — appendAuditLog helper em vez de raw $executeRaw (3 ocorrências)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CreateNoteSchema = z.object({
  patientId: z.string().uuid(),
  content: z.string().min(1).max(20000),
  category: z
    .enum(["evolution", "anamnesis", "assessment", "plan"])
    .default("evolution"),
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
  // NOTA: contentPreview armazena os primeiros 60 chars em CLEAR TEXT
  // para busca/preview na UI. É trade-off de design conhecido — usuários
  // devem evitar PII direta nas primeiras palavras da nota (UI alerta).
  const preview = data.content.slice(0, 60);

  try {
    const created = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // Verificar que paciente pertence à org (defense-in-depth)
        const patientExists = await tx.patient.findFirst({
          where: { id: data.patientId, organizationId },
          select: { id: true },
        });
        if (!patientExists)
          throw new Error("Paciente não encontrado nesta organização");

        const encrypted = await tx.$queryRaw<{ encrypted: Buffer }[]>`
          SELECT phi.encrypt_for_org(${data.content}, ${organizationId}::uuid) AS encrypted
        `;

        if (!encrypted[0]?.encrypted) {
          throw new Error(
            "Falha ao criptografar — DEK pode não estar configurada para esta org",
          );
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

        // CORREÇÃO QA #71: appendAuditLog helper.
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "clinical_note.create",
          entityType: "ClinicalNote",
          entityId: note.id,
          patientId: data.patientId,
          fieldsAccessed: ["encryptedContent"],
          payload: { category: data.category },
        });

        return note;
      },
    );

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
      message: msg.includes("DEK")
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
  // CORREÇÃO QA #69: UUID validation antes de qualquer query.
  if (!patientId || !UUID_REGEX.test(patientId)) {
    return [];
  }

  try {
    return await withTenantAction(async ({ tx, organizationId, userId }) => {
      // CORREÇÃO QA #69: org check explícito.
      const notes = await tx.clinicalNote.findMany({
        where: { patientId, organizationId },
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

      // CORREÇÃO QA #71: appendAuditLog (lista PHI ainda é PHI access).
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "clinical_note.list",
        entityType: "ClinicalNote",
        entityId: null,
        patientId,
        fieldsAccessed: ["preview"],
        payload: { count: notes.length },
      });

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
  // CORREÇÃO QA #70: UUID validation antes de qualquer query.
  if (!noteId || !UUID_REGEX.test(noteId)) {
    return { ok: false, message: "noteId inválido" };
  }

  try {
    return await withTenantAction(async ({ tx, organizationId, userId }) => {
      // CORREÇÃO QA #70: org check explícito no findFirst.
      const note = await tx.clinicalNote.findFirst({
        where: { id: noteId, organizationId },
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

      // CORREÇÃO QA #71: appendAuditLog helper (read PHI = audit detalhado).
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "clinical_note.read.content",
        entityType: "ClinicalNote",
        entityId: noteId,
        patientId: note.patientId,
        fieldsAccessed: ["encryptedContent.decrypted"],
        payload: {},
      });

      return {
        ok: true,
        content:
          decrypted[0]?.content ?? "(conteúdo não pôde ser descriptografado)",
      };
    });
  } catch (err) {
    console.error("[clinical-note/read]", err);
    return { ok: false, message: "Erro ao descriptografar" };
  }
}
