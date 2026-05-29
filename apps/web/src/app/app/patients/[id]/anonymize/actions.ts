"use server";

// CORREÇÃO QA Rodada 5 — anonymization Lock 4/13:
//   #58 — hashString agora usa HMAC-SHA256 (era hash polinomial trivialmente
//         reversível). Para audit LGPD prova "conhecia o nome" sem revelá-lo.
//   #59 — IMPLEMENTAR de fato o scrub de ClinicalNote/ExamAttachment/etc
//         (versão anterior só tinha comentário, sem código).
//   #60+#62 — organizationId explicit em findFirst (defense-in-depth).
//   #61 — UUID validation em archivePatientAction.
//   #63 — RBAC: apenas org_owner / clinic_admin podem anonimizar.
//   #64 — appendAuditLog helper em vez de raw $executeRaw (2 ocorrências).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

export interface AnonymizeResult {
  ok: boolean;
  message?: string;
  patientId?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AnonymizeSchema = z.object({
  patientId: z.string().uuid(),
  confirmPhrase: z.string(),
  reason: z.string().min(10).max(500),
});

// Roles permitidas a executar a operação destrutiva.
const ALLOWED_ANONYMIZE_ROLES = new Set(["org_owner", "clinic_admin"]);

/** CORREÇÃO QA #58: HMAC-SHA256 com segredo de servidor. Sem o segredo,
 * regulador/atacante não consegue brute-force reverter para nomes plain. */
function getNameHashSecret(): string {
  const s = process.env.ANONYMIZE_HASH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ANONYMIZE_HASH_SECRET missing or too short (min 32 chars)",
      );
    }
    return "dev-only-anonymize-hash-secret-min-32-chars";
  }
  return s;
}

function hashNameForAudit(s: string): string {
  return (
    "hmac256:" +
    createHmac("sha256", getNameHashSecret())
      .update(s)
      .digest("hex")
      .slice(0, 32)
  );
}

/**
 * Anonimiza um Patient nesta organização (Lock 4 + 13; LGPD Art. 18, V).
 *
 * Implementado nesta versão (versão anterior tinha código incompleto):
 * - Patient PII fields → null + status = ANONYMIZED + anonymizedAt = now()
 * - ClinicalNote.encryptedContent → null + contentPreview = '[ANONIMIZADO]'
 * - ExamAttachment.encryptedMetadata → null + notesPreview = '[ANONIMIZADO]'
 *   + fileName = '[redigido]' (storagePath mantém para audit; arquivos físicos
 *   no Storage devem ser deletados por job assíncrono — fora do escopo MVP)
 * - PatientInvite pendentes revogados
 *
 * NÃO toca (intencional):
 * - Patient.userId (Lock 6: User é global, deletar conta requer fluxo
 *   separado vindo do app paciente)
 * - PatientAllergy/DietaryRestriction/ClinicalCondition (dados clínicos
 *   sem PII direta — epidemiologia futura)
 * - MealItem / ClinicalDocument (Lock 15: snapshot imutável; doc emitido
 *   com CPF é prova fiscal)
 * - patient_name_snapshot em ClinicalDocument (prova de emissão)
 *
 * Restrições:
 * - Apenas org_owner / clinic_admin (RBAC; QA #63)
 * - Confirm phrase + reason obrigatórios (anti click acidental)
 * - Não-idempotente: já-anonimizado rejeita
 */
export async function anonymizePatientAction(input: {
  patientId: string;
  confirmPhrase: string;
  reason: string;
}): Promise<AnonymizeResult> {
  const parsed = AnonymizeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }

  const EXPECTED_PHRASE = "ANONIMIZAR DADOS";
  if (parsed.data.confirmPhrase.trim().toUpperCase() !== EXPECTED_PHRASE) {
    return {
      ok: false,
      message: `Digite exatamente "${EXPECTED_PHRASE}" para confirmar`,
    };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId, role }) => {
        // CORREÇÃO QA #63: RBAC — apenas roles administrativos podem anonimizar.
        if (!ALLOWED_ANONYMIZE_ROLES.has(role)) {
          throw new Error(
            "Apenas Admin/Owner da organização pode anonimizar pacientes",
          );
        }

        // CORREÇÃO QA #62: organizationId explícito.
        const patient = await tx.patient.findFirst({
          where: { id: parsed.data.patientId, organizationId },
          select: {
            id: true,
            fullName: true,
            cpf: true,
            email: true,
            status: true,
            userId: true,
          },
        });
        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");
        if (patient.status === "ANONYMIZED") {
          throw new Error("Paciente já está anonimizado");
        }

        const now = new Date();

        // 1. Scrub Patient (PHI fields)
        await tx.patient.update({
          where: { id: patient.id },
          data: {
            status: "ANONYMIZED",
            anonymizedAt: now,
            fullName: "Paciente anonimizado",
            preferredName: null,
            cpf: null,
            email: null,
            phone: null,
            birthDate: null,
            biologicalSex: null,
            genderIdentity: null,
            city: null,
            state: null,
            postalCode: null,
            street: null,
            number: null,
            complement: null,
            neighborhood: null,
            occupation: null,
            notes: null,
          },
        });

        // CORREÇÃO QA #59: SCRUB de fato as ClinicalNotes (versão anterior
        // só tinha comentário). Substitui encryptedContent por buffer mínimo
        // (Postgres bytea requer NOT NULL via schema; usamos empty buffer).
        await tx.clinicalNote.updateMany({
          where: { patientId: patient.id, organizationId },
          data: {
            encryptedContent: Buffer.alloc(0),
            contentPreview: "[ANONIMIZADO]",
          },
        });

        // CORREÇÃO QA #59: scrub ExamAttachment metadata + filename.
        // Arquivos físicos no Supabase Storage devem ser deletados por
        // worker assíncrono — fora do escopo MVP (registrado em audit).
        await tx.examAttachment.updateMany({
          where: { patientId: patient.id, organizationId },
          data: {
            fileName: "[redigido]",
            encryptedMetadata: null,
            notesPreview: "[ANONIMIZADO]",
          },
        });

        // Revogar todos os invites pendentes
        await tx.patientInvite.updateMany({
          where: {
            patientId: patient.id,
            organizationId,
            acceptedAt: null,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokedReason: "Patient anonymized",
          },
        });

        // CORREÇÃO QA #64: appendAuditLog helper (parameter binding correto).
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: "patient.anonymize",
          entityType: "Patient",
          entityId: patient.id,
          patientId: patient.id,
          fieldsAccessed: [
            "status",
            "fullName",
            "cpf",
            "email",
            "phone",
            "address",
            "notes",
            "clinicalNotes.encryptedContent",
            "examAttachments.metadata",
          ],
          payload: {
            reason: parsed.data.reason,
            // CORREÇÃO QA #58: HMAC do nome (não hash polinomial).
            previousNameHash: hashNameForAudit(patient.fullName),
            hadCpf: Boolean(patient.cpf),
            hadEmail: Boolean(patient.email),
            hadUserAccount: Boolean(patient.userId),
          },
        });

        return { patient };
      },
    );

    revalidatePath("/app/patients");
    revalidatePath(`/app/patients/${parsed.data.patientId}`);
    return { ok: true, patientId: result.patient.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}

/**
 * Arquiva (soft) sem anonimizar — patient não aparece nas listas default
 * mas dados permanecem. Reversível.
 */
export async function archivePatientAction(
  patientId: string,
): Promise<AnonymizeResult> {
  // CORREÇÃO QA #61: UUID validation.
  if (!patientId || !UUID_REGEX.test(patientId)) {
    return { ok: false, message: "patientId inválido" };
  }

  try {
    await withTenantAction(async ({ tx, organizationId, userId, role }) => {
      // CORREÇÃO QA #60: organizationId explícito.
      const patient = await tx.patient.findFirst({
        where: { id: patientId, organizationId },
        select: { id: true, status: true },
      });
      if (!patient)
        throw new Error("Paciente não encontrado nesta organização");
      if (patient.status === "ANONYMIZED") {
        throw new Error("Paciente anonimizado não pode ser arquivado");
      }

      const willUnarchive = patient.status === "ARCHIVED";

      await tx.patient.update({
        where: { id: patientId },
        data: {
          status: willUnarchive ? "ACTIVE" : "ARCHIVED",
          archivedAt: willUnarchive ? null : new Date(),
        },
      });

      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action: willUnarchive ? "patient.unarchive" : "patient.archive",
        entityType: "Patient",
        entityId: patientId,
        patientId,
        fieldsAccessed: ["status"],
        payload: {},
      });
    });
    revalidatePath("/app/patients");
    revalidatePath(`/app/patients/${patientId}`);
    return { ok: true, patientId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}
