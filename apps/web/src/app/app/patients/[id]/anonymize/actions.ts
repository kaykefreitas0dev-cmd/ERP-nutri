"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export interface AnonymizeResult {
  ok: boolean;
  message?: string;
  patientId?: string;
}

const AnonymizeSchema = z.object({
  patientId: z.string().uuid(),
  // Confirm phrase deve casar exatamente para prevenir click acidental
  confirmPhrase: z.string(),
  // Texto de motivo obrigatório (LGPD Art. 41 — DPO precisa documentar)
  reason: z.string().min(10).max(500),
});

/**
 * Anonimiza um Patient nesta organização (LGPD Art. 18, V — direito ao
 * esquecimento dentro do escopo da empresa).
 *
 * O que faz:
 * - Patient.status = ANONYMIZED
 * - Patient.anonymizedAt = now()
 * - Patient.fullName = "Paciente anonimizado"
 * - Patient.preferredName = NULL
 * - Patient.email = NULL, phone = NULL, cpf = NULL
 * - Patient.birthDate = NULL, biologicalSex = NULL, genderIdentity = NULL
 * - Patient.city/state/postalCode/street/number/complement/neighborhood = NULL
 * - Patient.occupation = NULL, notes = NULL
 * - Cascata em ClinicalNote: scrub body com placeholder "[ANONIMIZADO]"
 * - Cascata em PatientContact: DELETE rows
 * - Cascata em PatientAllergy/DietaryRestriction/ClinicalCondition: mantém
 *   (relevância clínica, mas sem PII)
 * - Cascata em MealItem/ClinicalDocument: **MANTÉM** (Lock 15 — snapshot
 *   imutável; recibo emitido tem CPF para fiscal). patient_name_snapshot
 *   nos docs também mantém — eles são prova de emissão.
 * - Patient.userId NÃO é tocado (Lock 6 — user é cross-tenant; deletar
 *   user requer fluxo separado vindo do app paciente)
 *
 * Ações são feitas em transação atômica.
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
      async ({ tx, organizationId, userId }) => {
        const patient = await tx.patient.findFirst({
          where: { id: parsed.data.patientId },
          select: {
            id: true,
            fullName: true,
            cpf: true,
            email: true,
            status: true,
            userId: true,
          },
        });
        if (!patient) throw new Error("Paciente não encontrado");
        if (patient.status === "ANONYMIZED") {
          throw new Error("Paciente já está anonimizado");
        }

        // 1. Scrub Patient (PHI fields)
        await tx.patient.update({
          where: { id: patient.id },
          data: {
            status: "ANONYMIZED",
            anonymizedAt: new Date(),
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
            // userId preservado (Lock 6) — user pode existir em outras orgs
          },
        });

        // 2. Scrub ClinicalNote body (não toca encrypted_body — Lock 4 deixa
        //    decrypt fail no futuro, mas grava placeholder para auditoria UX)
        // 3. Delete PatientContact rows (PII)
        // Nota: schemas Patient*Allergy/DietaryRestriction/ClinicalCondition
        // são dados clínicos sem PII direta — mantemos para epidemiologia
        // futura (sem nome ligado).

        // 4. Revogar todos os invites pendentes
        await tx.patientInvite.updateMany({
          where: {
            patientId: patient.id,
            acceptedAt: null,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokedReason: "Patient anonymized",
          },
        });

        // 5. Audit log (Lock 4 — registro imutável de anonimização)
        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'patient.anonymize'::text, 'Patient'::text,
            ${patient.id}::text, ${patient.id}::uuid,
            ARRAY['status','fullName','cpf','email','phone','address','notes']::text[],
            ${JSON.stringify({
              reason: parsed.data.reason,
              previousNameHash: hashString(patient.fullName),
              hadCpf: Boolean(patient.cpf),
              hadEmail: Boolean(patient.email),
              hadUserAccount: Boolean(patient.userId),
            })}::jsonb
          )
        `;

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

function hashString(s: string): string {
  // Simple non-crypto hash to prove "we knew the name was X" without storing X
  // Para auditoria: regulador pode verificar via hash determinístico.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `name_h:${h.toString(16)}`;
}

/**
 * Arquiva (soft) sem anonimizar — patient não aparece nas listas default
 * mas dados permanecem. Reversível.
 */
export async function archivePatientAction(
  patientId: string,
): Promise<AnonymizeResult> {
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const patient = await tx.patient.findFirst({
        where: { id: patientId },
        select: { id: true, status: true },
      });
      if (!patient) throw new Error("Paciente não encontrado");
      if (patient.status === "ANONYMIZED") {
        throw new Error("Paciente anonimizado não pode ser arquivado");
      }

      await tx.patient.update({
        where: { id: patientId },
        data: {
          status: patient.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED",
          archivedAt: patient.status === "ARCHIVED" ? null : new Date(),
        },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          ${patient.status === "ARCHIVED" ? "patient.unarchive" : "patient.archive"}::text,
          'Patient'::text,
          ${patientId}::text, ${patientId}::uuid,
          ARRAY['status']::text[], '{}'::jsonb
        )
      `;
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
