"use server";

// Templates de plano alimentar (MealPlanTemplate).
// Nutri salva um plano como modelo reutilizável e aplica em novos pacientes.
//
// structure JSON: { days: [{ dayLabel, sortOrder, notes, meals: [...] }] }
// foodVersion preservado (Lock 15) ao aplicar.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TemplateActionResult {
  ok: boolean;
  message?: string;
  templateId?: string;
  mealPlanId?: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  targetKcal: number | null;
  dayCount: number;
  mealCount: number;
  usageCount: number;
  isPublic: boolean;
  createdAt: Date;
}

// ── Tipos da structure serializada ──────────────────────────────────────
interface TemplateItem {
  foodId: string;
  foodVersion: number;
  quantityG: number;
  preparationNotes: string | null;
  sortOrder: number;
  kcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
}
interface TemplateMeal {
  name: string;
  scheduledTime: string | null;
  sortOrder: number;
  notes: string | null;
  items: TemplateItem[];
}
interface TemplateDay {
  dayLabel: string;
  sortOrder: number;
  notes: string | null;
  meals: TemplateMeal[];
}
interface TemplateStructure {
  days: TemplateDay[];
}

// Linha do select de listTemplatesAction. Anotada explicitamente porque o
// client de transação tenant-scoped não infere o payload do findMany.
interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  targetKcal: { toString(): string } | null;
  structure: unknown;
  usageCount: number;
  isPublic: boolean;
  createdAt: Date;
}

const SaveTemplateSchema = z.object({
  planId: z.string().uuid(),
  patientId: z.string().uuid(),
  name: z.string().min(2).max(120).trim(),
  description: z.string().max(500).optional().or(z.literal("")),
});

/**
 * Serializa um plano existente como MealPlanTemplate (structure JSON).
 */
export async function saveAsTemplateAction(input: {
  planId: string;
  patientId: string;
  name: string;
  description?: string;
}): Promise<TemplateActionResult> {
  const parsed = SaveTemplateSchema.safeParse(input);
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
        const plan = await tx.mealPlan.findFirst({
          where: { id: d.planId, organizationId, patientId: d.patientId },
          include: {
            days: {
              orderBy: { sortOrder: "asc" },
              include: {
                meals: {
                  orderBy: { sortOrder: "asc" },
                  include: { items: { orderBy: { sortOrder: "asc" } } },
                },
              },
            },
          },
        });
        if (!plan) throw new Error("Plano não encontrado");

        const structure: TemplateStructure = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          days: (plan.days as any[]).map((day) => ({
            dayLabel: day.dayLabel,
            sortOrder: day.sortOrder,
            notes: day.notes,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            meals: (day.meals as any[]).map((meal) => ({
              name: meal.name,
              scheduledTime: meal.scheduledTime,
              sortOrder: meal.sortOrder,
              notes: meal.notes,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              items: (meal.items as any[]).map((item) => ({
                foodId: item.foodId,
                foodVersion: item.foodVersion,
                quantityG: Number(item.quantityG),
                preparationNotes: item.preparationNotes,
                sortOrder: item.sortOrder,
                kcal: item.kcal != null ? Number(item.kcal) : null,
                proteinG: item.proteinG != null ? Number(item.proteinG) : null,
                carbG: item.carbG != null ? Number(item.carbG) : null,
                fatG: item.fatG != null ? Number(item.fatG) : null,
              })),
            })),
          })),
        };

        const template = await tx.mealPlanTemplate.create({
          data: {
            organizationId,
            createdByUserId: userId,
            name: d.name,
            description: d.description || null,
            targetKcal: plan.targetKcal,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            structure: structure as any,
          },
        });

        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "meal_plan_template.create",
          entityType: "MealPlanTemplate",
          entityId: template.id,
          patientId: null,
          fieldsAccessed: ["name", "structure"],
          payload: { sourcePlanId: d.planId, days: structure.days.length },
        });

        return template;
      },
    );

    revalidatePath(`/app/patients/${d.patientId}/meal-plans`);
    return { ok: true, templateId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

/**
 * Lista templates da org (próprios + públicos).
 */
export async function listTemplatesAction(): Promise<TemplateSummary[]> {
  try {
    return await withTenantAction(async ({ tx, organizationId }) => {
      const templates = await tx.mealPlanTemplate.findMany({
        where: {
          OR: [{ organizationId }, { isPublic: true }],
        },
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          name: true,
          description: true,
          targetKcal: true,
          structure: true,
          usageCount: true,
          isPublic: true,
          createdAt: true,
        },
      });

      return templates.map((t: TemplateRow) => {
        const structure = (t.structure as unknown as TemplateStructure) ?? {
          days: [],
        };
        const dayCount = structure.days?.length ?? 0;
        const mealCount =
          structure.days?.reduce(
            (sum, day) => sum + (day.meals?.length ?? 0),
            0,
          ) ?? 0;
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          targetKcal: t.targetKcal != null ? Number(t.targetKcal) : null,
          dayCount,
          mealCount,
          usageCount: t.usageCount,
          isPublic: t.isPublic,
          createdAt: t.createdAt,
        };
      });
    });
  } catch {
    return [];
  }
}

const ApplyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  patientId: z.string().uuid(),
  name: z.string().min(2).max(120).trim(),
});

/**
 * Aplica um template a um paciente: cria novo MealPlan DRAFT com a structure.
 */
export async function applyTemplateAction(input: {
  templateId: string;
  patientId: string;
  name: string;
}): Promise<TemplateActionResult> {
  const parsed = ApplyTemplateSchema.safeParse(input);
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
        // Template: própria org OU público
        const template = await tx.mealPlanTemplate.findFirst({
          where: {
            id: d.templateId,
            OR: [{ organizationId }, { isPublic: true }],
          },
        });
        if (!template) throw new Error("Modelo não encontrado");

        // Paciente desta org
        const patient = await tx.patient.findFirst({
          where: { id: d.patientId, organizationId },
          select: { id: true },
        });
        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");

        const structure =
          (template.structure as unknown as TemplateStructure) ?? { days: [] };

        // Novo plano DRAFT
        const newPlan = await tx.mealPlan.create({
          data: {
            organizationId,
            patientId: d.patientId,
            prescribedByUserId: userId,
            name: d.name,
            status: "DRAFT",
            targetKcal: template.targetKcal,
          },
        });

        // Recria days → meals → items da structure
        for (const day of structure.days ?? []) {
          const newDay = await tx.mealPlanDay.create({
            data: {
              mealPlanId: newPlan.id,
              dayLabel: day.dayLabel,
              sortOrder: day.sortOrder,
              notes: day.notes,
            },
          });
          for (const meal of day.meals ?? []) {
            const newMeal = await tx.meal.create({
              data: {
                mealPlanDayId: newDay.id,
                name: meal.name,
                scheduledTime: meal.scheduledTime,
                sortOrder: meal.sortOrder,
                notes: meal.notes,
              },
            });
            if (meal.items?.length) {
              await tx.mealItem.createMany({
                data: meal.items.map((item) => ({
                  mealId: newMeal.id,
                  foodId: item.foodId,
                  foodVersion: item.foodVersion, // Lock 15 snapshot
                  quantityG: item.quantityG,
                  preparationNotes: item.preparationNotes,
                  sortOrder: item.sortOrder,
                  kcal: item.kcal,
                  proteinG: item.proteinG,
                  carbG: item.carbG,
                  fatG: item.fatG,
                })),
              });
            }
          }
        }

        // Incrementa usageCount
        await tx.mealPlanTemplate.update({
          where: { id: template.id },
          data: { usageCount: { increment: 1 } },
        });

        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "meal_plan_template.apply",
          entityType: "MealPlan",
          entityId: newPlan.id,
          patientId: d.patientId,
          fieldsAccessed: ["templateId"],
          payload: { templateId: d.templateId },
        });

        return newPlan;
      },
    );

    revalidatePath(`/app/patients/${d.patientId}/meal-plans`);
    return { ok: true, mealPlanId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

/**
 * Deleta um template (apenas da própria org).
 * patientId é usado apenas para revalidar a página correta (lista de modelos
 * vive em /app/patients/[id]/meal-plans).
 */
export async function deleteTemplateAction(input: {
  templateId: string;
  patientId: string;
}): Promise<TemplateActionResult> {
  if (!input.templateId || !UUID_REGEX.test(input.templateId)) {
    return { ok: false, message: "templateId inválido" };
  }
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const template = await tx.mealPlanTemplate.findFirst({
        where: { id: input.templateId, organizationId },
        select: { id: true },
      });
      if (!template) throw new Error("Modelo não encontrado nesta organização");

      await tx.mealPlanTemplate.delete({ where: { id: input.templateId } });

      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "meal_plan_template.delete",
        entityType: "MealPlanTemplate",
        entityId: input.templateId,
        patientId: null,
        fieldsAccessed: ["id"],
        payload: {},
      });
    });
    revalidatePath(`/app/patients/${input.patientId}/meal-plans`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}
