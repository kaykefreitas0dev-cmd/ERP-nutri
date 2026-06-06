"use server";

// Metas do paciente + tracking. Tenant-scoped (withTenantAction + RLS).
// type/direction/status validados por Zod (espelham os CHECK do DB).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";
import {
  GOAL_TYPES,
  GOAL_DIRECTIONS,
  GOAL_STATUSES,
  type GoalType,
  type GoalDirection,
  type GoalStatus,
} from "./goal-utils";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface GoalActionResult {
  ok: boolean;
  message?: string;
  goalId?: string;
}

const CreateGoalSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().min(2).max(160).trim(),
  description: z.string().max(2000).optional().or(z.literal("")),
  type: z.enum(GOAL_TYPES).default("OTHER"),
  direction: z.enum(GOAL_DIRECTIONS).default("DECREASE"),
  startValue: z
    .number()
    .finite()
    .min(-100000)
    .max(1000000)
    .nullable()
    .optional(),
  targetValue: z
    .number()
    .finite()
    .min(-100000)
    .max(1000000)
    .nullable()
    .optional(),
  currentValue: z
    .number()
    .finite()
    .min(-100000)
    .max(1000000)
    .nullable()
    .optional(),
  unit: z.string().max(20).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function createGoalAction(input: {
  patientId: string;
  title: string;
  description?: string;
  type?: GoalType;
  direction?: GoalDirection;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string;
  dueDate?: string;
}): Promise<GoalActionResult> {
  const parsed = CreateGoalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }
  const d = parsed.data;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // Paciente precisa existir nesta org (RLS já garante, mas falha clara).
        const patient = await tx.patient.findFirst({
          where: { id: d.patientId, organizationId },
          select: { id: true },
        });
        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");

        const goal = await tx.patientGoal.create({
          data: {
            organizationId,
            patientId: d.patientId,
            createdByUserId: userId,
            title: d.title,
            description: d.description || null,
            type: d.type,
            direction: d.direction,
            startValue: d.startValue ?? null,
            targetValue: d.targetValue ?? null,
            // Se não veio currentValue, inicia no startValue (progresso 0).
            currentValue: d.currentValue ?? d.startValue ?? null,
            unit: d.unit || null,
            dueDate: d.dueDate ? new Date(d.dueDate) : null,
            status: "ACTIVE",
          },
        });

        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "patient_goal.create",
          entityType: "PatientGoal",
          entityId: goal.id,
          patientId: d.patientId,
          fieldsAccessed: ["title", "type", "targetValue"],
          payload: { type: d.type },
        });

        return goal;
      },
    );

    revalidatePath(`/app/patients/${d.patientId}/goals`);
    return { ok: true, goalId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

const UpdateProgressSchema = z.object({
  goalId: z.string().uuid(),
  patientId: z.string().uuid(),
  currentValue: z.number().finite().min(-100000).max(1000000),
});

export async function updateGoalProgressAction(input: {
  goalId: string;
  patientId: string;
  currentValue: number;
}): Promise<GoalActionResult> {
  const parsed = UpdateProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Valor inválido" };
  }
  const d = parsed.data;

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      // Busca a meta (escopada por org) p/ obter o patientId REAL — não confia
      // no patientId do caller para o audit (evita misattribution).
      const goal = await tx.patientGoal.findFirst({
        where: { id: d.goalId, organizationId },
        select: { patientId: true },
      });
      if (!goal) throw new Error("Meta não encontrada");

      await tx.patientGoal.update({
        where: { id: d.goalId },
        data: { currentValue: d.currentValue },
      });

      // currentValue pode ser PHI (peso/%GC) → audit obrigatório (LGPD).
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "patient_goal.progress.update",
        entityType: "PatientGoal",
        entityId: d.goalId,
        patientId: goal.patientId,
        fieldsAccessed: ["currentValue"],
        payload: { currentValue: d.currentValue },
      });
    });
    revalidatePath(`/app/patients/${d.patientId}/goals`);
    return { ok: true, goalId: d.goalId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

const UpdateStatusSchema = z.object({
  goalId: z.string().uuid(),
  patientId: z.string().uuid(),
  status: z.enum(GOAL_STATUSES),
});

export async function updateGoalStatusAction(input: {
  goalId: string;
  patientId: string;
  status: GoalStatus;
}): Promise<GoalActionResult> {
  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Status inválido" };
  }
  const d = parsed.data;

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const goal = await tx.patientGoal.findFirst({
        where: { id: d.goalId, organizationId },
        select: { patientId: true },
      });
      if (!goal) throw new Error("Meta não encontrada");

      await tx.patientGoal.update({
        where: { id: d.goalId },
        data: {
          status: d.status,
          achievedAt: d.status === "ACHIEVED" ? new Date() : null,
        },
      });

      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: `patient_goal.status.${d.status.toLowerCase()}`,
        entityType: "PatientGoal",
        entityId: d.goalId,
        patientId: goal.patientId,
        fieldsAccessed: ["status"],
        payload: { status: d.status },
      });
    });
    revalidatePath(`/app/patients/${d.patientId}/goals`);
    return { ok: true, goalId: d.goalId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function deleteGoalAction(input: {
  goalId: string;
  patientId: string;
}): Promise<GoalActionResult> {
  if (!input.goalId || !UUID_REGEX.test(input.goalId)) {
    return { ok: false, message: "Meta inválida" };
  }
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const goal = await tx.patientGoal.findFirst({
        where: { id: input.goalId, organizationId },
        select: { patientId: true },
      });
      if (!goal) throw new Error("Meta não encontrada");

      await tx.patientGoal.delete({ where: { id: input.goalId } });

      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "patient_goal.delete",
        entityType: "PatientGoal",
        entityId: input.goalId,
        patientId: goal.patientId,
        fieldsAccessed: ["id"],
        payload: {},
      });
    });
    revalidatePath(`/app/patients/${input.patientId}/goals`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}
