"use server";

// CORREÇÃO QA Rodada 5:
//   #66 — patient.findFirst com organizationId explícito (defense-in-depth)
//   #67 — appendAuditLog helper em vez de raw $executeRaw (2 ocorrências)
//   #68 — UUID validation em deleteAnthropometryAction

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";
import {
  bmiRounded,
  bmrMifflin,
  bmrHarris,
  bmrFao,
  calcBodyFat,
  round,
  type BiologicalSex,
} from "@nutricore/nutrition";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CreateAnthropometrySchema = z.object({
  patientId: z.string().uuid(),
  measuredAt: z.string().optional(),
  protocol: z
    .enum(["pollock_3", "pollock_7", "manual_bia", "oms_pediatric"])
    .default("pollock_3"),
  weightKg: z.coerce.number().positive().max(500).optional(),
  heightCm: z.coerce.number().positive().max(300).optional(),
  // Circunferências (cm)
  waist: z.coerce.number().min(0).max(300).optional(),
  hip: z.coerce.number().min(0).max(300).optional(),
  abdomen: z.coerce.number().min(0).max(300).optional(),
  // Dobras (mm)
  triceps: z.coerce.number().min(0).max(100).optional(),
  subscapular: z.coerce.number().min(0).max(100).optional(),
  suprailiac: z.coerce.number().min(0).max(100).optional(),
  thigh: z.coerce.number().min(0).max(100).optional(),
  chest: z.coerce.number().min(0).max(100).optional(),
  abdominal: z.coerce.number().min(0).max(100).optional(),
  midaxillary: z.coerce.number().min(0).max(100).optional(),
  // BIA
  biaBodyFatPct: z.coerce.number().min(0).max(80).optional(),
  biaLeanMassKg: z.coerce.number().min(0).max(200).optional(),
  notes: z.string().max(2000).optional(),
});

interface PatientForCalc {
  birthDate: Date | null;
  biologicalSex: string | null;
}

function calcAgeYears(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const bd = new Date(birthDate);
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

export async function createAnthropometryAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; recordId?: string }> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateAnthropometrySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Dados inválidos: " +
        Object.entries(parsed.error.flatten().fieldErrors)
          .map(([k, v]) => `${k}=${v?.join(",")}`)
          .join("; "),
    };
  }

  const d = parsed.data;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // CORREÇÃO QA #66: organizationId explícito.
        const patient = (await tx.patient.findFirst({
          where: { id: d.patientId, organizationId },
          select: { birthDate: true, biologicalSex: true },
        })) as PatientForCalc | null;

        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");

        const ageYears = calcAgeYears(patient.birthDate);
        const sex = patient.biologicalSex as BiologicalSex | null;

        // Cálculos
        let bmi: number | null = null;
        let bmrMif: number | null = null;
        let bmrHar: number | null = null;
        let bmrF: number | null = null;
        let bodyFatPctCalc: number | null = null;
        let leanMassCalc: number | null = null;

        if (d.weightKg && d.heightCm) {
          bmi = bmiRounded(d.weightKg, d.heightCm);
        }

        if (
          d.weightKg &&
          d.heightCm &&
          ageYears != null &&
          (sex === "male" || sex === "female")
        ) {
          bmrMif = round(
            bmrMifflin({
              weightKg: d.weightKg,
              heightCm: d.heightCm,
              ageYears,
              sex,
            }),
            1,
          );
          bmrHar = round(
            bmrHarris({
              weightKg: d.weightKg,
              heightCm: d.heightCm,
              ageYears,
              sex,
            }),
            1,
          );
          bmrF = round(
            bmrFao({
              weightKg: d.weightKg,
              heightCm: d.heightCm,
              ageYears,
              sex,
            }),
            1,
          );
        }

        // Body fat — Pollock 3
        if (
          d.protocol === "pollock_3" &&
          d.thigh != null &&
          d.weightKg &&
          ageYears != null &&
          (sex === "male" || sex === "female")
        ) {
          try {
            const skinfolds =
              sex === "male"
                ? {
                    chest: d.chest ?? 0,
                    abdominal: d.abdominal ?? 0,
                    thigh: d.thigh,
                  }
                : {
                    triceps: d.triceps ?? 0,
                    suprailiac: d.suprailiac ?? 0,
                    thigh: d.thigh,
                  };
            const bf = calcBodyFat(
              "pollock_3",
              skinfolds,
              ageYears,
              sex,
              d.weightKg,
            );
            bodyFatPctCalc = bf.bodyFatPct;
            leanMassCalc = bf.leanMassKg;
          } catch {
            // dobras zeradas — silently skip
          }
        }

        // BIA manual sobrescreve cálculo de body fat
        if (d.biaBodyFatPct != null) {
          bodyFatPctCalc = d.biaBodyFatPct;
        }
        if (d.biaLeanMassKg != null) {
          leanMassCalc = d.biaLeanMassKg;
        }

        const circumferences = Object.fromEntries(
          Object.entries({
            waist: d.waist,
            hip: d.hip,
            abdomen: d.abdomen,
          }).filter(([, v]) => v != null),
        );
        const skinfolds = Object.fromEntries(
          Object.entries({
            triceps: d.triceps,
            subscapular: d.subscapular,
            suprailiac: d.suprailiac,
            thigh: d.thigh,
            chest: d.chest,
            abdominal: d.abdominal,
            midaxillary: d.midaxillary,
          }).filter(([, v]) => v != null),
        );
        const bia = Object.fromEntries(
          Object.entries({
            bodyFatPct: d.biaBodyFatPct,
            leanMassKg: d.biaLeanMassKg,
          }).filter(([, v]) => v != null),
        );

        const record = await tx.anthropometry.create({
          data: {
            organizationId,
            patientId: d.patientId,
            measuredByUserId: userId,
            measuredAt: d.measuredAt ? new Date(d.measuredAt) : new Date(),
            protocol: d.protocol,
            weightKg: d.weightKg ?? null,
            heightCm: d.heightCm ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            circumferences: circumferences as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            skinfolds: skinfolds as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            bia: bia as any,
            bodyMassIndex: bmi,
            bodyFatPctCalc,
            leanMassKgCalc: leanMassCalc,
            basalMetabolismMifflin: bmrMif,
            basalMetabolismHarris: bmrHar,
            basalMetabolismFao: bmrF,
            notes: d.notes ?? null,
          },
        });

        // CORREÇÃO QA #67: appendAuditLog helper.
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "anthropometry.create",
          entityType: "Anthropometry",
          entityId: record.id,
          patientId: d.patientId,
          fieldsAccessed: ["weightKg", "heightCm", "skinfolds"],
          payload: {},
        });

        return record;
      },
    );

    revalidatePath(`/app/patients/${d.patientId}/anthropometry`);
    revalidatePath(`/app/patients/${d.patientId}`);
    return { ok: true, recordId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[anthropometry/create]", err);
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function deleteAnthropometryAction(
  recordId: string,
  patientId: string,
): Promise<{ ok: boolean; message?: string }> {
  // CORREÇÃO QA #68: UUID validation.
  if (!recordId || !UUID_REGEX.test(recordId)) {
    return { ok: false, message: "recordId inválido" };
  }
  if (!patientId || !UUID_REGEX.test(patientId)) {
    return { ok: false, message: "patientId inválido" };
  }

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      // Verify the record belongs to this org+patient (RLS covers org; extra check for patient)
      const record = await tx.anthropometry.findFirst({
        where: { id: recordId, patientId, organizationId },
        select: { id: true },
      });
      if (!record) throw new Error("Medição não encontrada");

      await tx.anthropometry.delete({ where: { id: recordId } });

      // CORREÇÃO QA #67: appendAuditLog helper.
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "anthropometry.delete",
        entityType: "Anthropometry",
        entityId: recordId,
        patientId,
        fieldsAccessed: ["id"],
        payload: {},
      });
    });

    revalidatePath(`/app/patients/${patientId}/anthropometry`);
    revalidatePath(`/app/patients/${patientId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[anthropometry/delete]", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao excluir",
    };
  }
}
