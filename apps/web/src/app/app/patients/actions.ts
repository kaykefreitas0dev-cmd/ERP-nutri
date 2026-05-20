"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

const CreatePatientSchema = z.object({
  fullName: z.string().min(2).max(120).trim(),
  preferredName: z.string().max(60).optional().or(z.literal("")),
  email: z.string().email().toLowerCase().trim().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  biologicalSex: z
    .enum(["female", "male", "intersex", "undisclosed"])
    .optional(),
  cpf: z.string().max(14).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  state: z.string().length(2).optional().or(z.literal("")),
  occupation: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export interface ActionResult {
  ok: boolean;
  message?: string;
  patientId?: string;
}

function emptyToUndef(v: unknown): unknown {
  return v === "" ? undefined : v;
}

export async function createPatientAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    fullName: formData.get("fullName"),
    preferredName: emptyToUndef(formData.get("preferredName")),
    email: emptyToUndef(formData.get("email")),
    phone: emptyToUndef(formData.get("phone")),
    birthDate: emptyToUndef(formData.get("birthDate")),
    biologicalSex: emptyToUndef(formData.get("biologicalSex")),
    cpf: emptyToUndef(formData.get("cpf")),
    city: emptyToUndef(formData.get("city")),
    state: emptyToUndef(formData.get("state")),
    occupation: emptyToUndef(formData.get("occupation")),
    notes: emptyToUndef(formData.get("notes")),
  };

  const parsed = CreatePatientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Verifique os campos: " +
        Object.entries(parsed.error.flatten().fieldErrors)
          .map(([k, v]) => `${k}=${v?.join(", ")}`)
          .join("; "),
    };
  }

  const data = parsed.data;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const created = await tx.patient.create({
          data: {
            organizationId,
            primaryNutritionistId: userId,
            fullName: data.fullName,
            preferredName: data.preferredName || null,
            email: data.email || null,
            phone: data.phone || null,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            biologicalSex: data.biologicalSex || null,
            cpf: data.cpf || null,
            city: data.city || null,
            state: data.state || null,
            occupation: data.occupation || null,
            notes: data.notes || null,
            status: "ACTIVE",
          },
        });

        // Audit log
        await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet,
          NULL::text,
          'patient.create'::text,
          'Patient'::text,
          ${created.id}::text,
          ${created.id}::uuid,
          ARRAY['fullName','email','phone']::text[],
          '{}'::jsonb
        )
      `;

        return created;
      },
    );

    revalidatePath("/app/patients");
    return { ok: true, patientId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[patients/create]", err);
    return { ok: false, message: "Erro ao criar paciente" };
  }
}

const UpdatePatientSchema = CreatePatientSchema.partial().extend({
  patientId: z.string().uuid(),
});

export async function updatePatientAction(
  formData: FormData,
): Promise<ActionResult> {
  const patientId = formData.get("patientId");
  if (!patientId || typeof patientId !== "string") {
    return { ok: false, message: "patientId obrigatório" };
  }

  const raw = {
    patientId,
    fullName: emptyToUndef(formData.get("fullName")),
    preferredName: emptyToUndef(formData.get("preferredName")),
    email: emptyToUndef(formData.get("email")),
    phone: emptyToUndef(formData.get("phone")),
    birthDate: emptyToUndef(formData.get("birthDate")),
    biologicalSex: emptyToUndef(formData.get("biologicalSex")),
    cpf: emptyToUndef(formData.get("cpf")),
    city: emptyToUndef(formData.get("city")),
    state: emptyToUndef(formData.get("state")),
    occupation: emptyToUndef(formData.get("occupation")),
    notes: emptyToUndef(formData.get("notes")),
  };

  const parsed = UpdatePatientSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos" };
  }

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const updated = await tx.patient.update({
        where: { id: parsed.data.patientId },
        data: {
          fullName: parsed.data.fullName,
          preferredName: parsed.data.preferredName || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          birthDate: parsed.data.birthDate
            ? new Date(parsed.data.birthDate)
            : null,
          biologicalSex: parsed.data.biologicalSex || null,
          cpf: parsed.data.cpf || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          occupation: parsed.data.occupation || null,
          notes: parsed.data.notes || null,
        },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet, NULL::text,
          'patient.update'::text,
          'Patient'::text,
          ${updated.id}::text,
          ${updated.id}::uuid,
          ARRAY[]::text[],
          '{}'::jsonb
        )
      `;
      return updated;
    });

    revalidatePath(`/app/patients/${patientId}`);
    revalidatePath("/app/patients");
    return { ok: true, patientId: patientId };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[patients/update]", err);
    return { ok: false, message: "Erro ao atualizar paciente" };
  }
}

export interface PatientRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  updatedAt: Date;
}

export interface FetchPatientsResult {
  ok: boolean;
  patients?: PatientRow[];
  nextCursor?: string | null;
  message?: string;
}

const PAGE_SIZE = 100;

export async function fetchPatientsPage(input: {
  status?: string;
  q?: string;
  cursor?: string | null;
}): Promise<FetchPatientsResult> {
  try {
    const result = await withTenantAction(async ({ tx }) => {
      const filterStatus = (input.status ?? "ACTIVE") as
        | "ACTIVE"
        | "ARCHIVED"
        | "ANONYMIZED";
      const cursorClause = input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : {};

      const patients = await tx.patient.findMany({
        where: {
          status: filterStatus,
          ...(input.q
            ? {
                OR: [
                  { fullName: { contains: input.q, mode: "insensitive" } },
                  { email: { contains: input.q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: PAGE_SIZE + 1, // +1 to detect next page
        ...cursorClause,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          updatedAt: true,
        },
      });

      let nextCursor: string | null = null;
      if (patients.length > PAGE_SIZE) {
        patients.pop();
        nextCursor = patients[patients.length - 1]?.id ?? null;
      }

      return { patients, nextCursor };
    });

    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: "Erro ao buscar pacientes" };
  }
}

export async function archivePatientAction(
  patientId: string,
): Promise<ActionResult> {
  if (!patientId) return { ok: false, message: "patientId obrigatório" };

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      await tx.patient.update({
        where: { id: patientId },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet, NULL::text,
          'patient.archive'::text,
          'Patient'::text,
          ${patientId}::text,
          ${patientId}::uuid,
          ARRAY[]::text[],
          '{}'::jsonb
        )
      `;
    });
    revalidatePath("/app/patients");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[patients/archive]", err);
    return { ok: false, message: "Erro ao arquivar" };
  }
}
