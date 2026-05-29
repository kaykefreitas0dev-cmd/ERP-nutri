"use server";

// CORREÇÃO QA Rodada 5:
//   #73 — appendAuditLog helper em vez de raw $executeRaw (3 ocorrências)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

const DEFAULT_MEALS = [
  { name: "Café da manhã", time: "07:00" },
  { name: "Lanche manhã", time: "10:00" },
  { name: "Almoço", time: "12:30" },
  { name: "Lanche tarde", time: "15:30" },
  { name: "Jantar", time: "19:30" },
  { name: "Ceia", time: "21:30" },
];

const CreatePlanSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(2).max(120).trim(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  targetKcal: z.coerce.number().min(600).max(6000).optional(),
});

export interface PlanActionResult {
  ok: boolean;
  message?: string;
  mealPlanId?: string;
}

export async function createMealPlanAction(
  formData: FormData,
): Promise<PlanActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreatePlanSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos" };
  }

  const d = parsed.data;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const plan = await tx.mealPlan.create({
          data: {
            organizationId,
            patientId: d.patientId,
            prescribedByUserId: userId,
            name: d.name,
            startDate: d.startDate ? new Date(d.startDate) : null,
            endDate: d.endDate ? new Date(d.endDate) : null,
            targetKcal: d.targetKcal ?? null,
            status: "DRAFT",
          },
        });

        // Dia padrão "Padrão" com 6 refeições
        const day = await tx.mealPlanDay.create({
          data: {
            mealPlanId: plan.id,
            dayLabel: "Padrão",
            sortOrder: 0,
          },
        });

        for (let i = 0; i < DEFAULT_MEALS.length; i++) {
          const m = DEFAULT_MEALS[i]!;
          await tx.meal.create({
            data: {
              mealPlanDayId: day.id,
              name: m.name,
              scheduledTime: m.time,
              sortOrder: i,
            },
          });
        }

        // CORREÇÃO QA #73: appendAuditLog helper.
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "meal_plan.create",
          entityType: "MealPlan",
          entityId: plan.id,
          patientId: d.patientId,
          fieldsAccessed: ["name", "targetKcal"],
          payload: {},
        });

        return plan;
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

const AddItemSchema = z.object({
  mealId: z.string().uuid(),
  foodId: z.string().uuid(),
  quantityG: z.coerce.number().positive().max(5000),
  preparationNotes: z.string().max(200).optional(),
});

export async function addMealItemAction(input: {
  mealId: string;
  foodId: string;
  quantityG: number;
  preparationNotes?: string;
}): Promise<{ ok: boolean; itemId?: string; message?: string }> {
  const parsed = AddItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos" };

  try {
    const item = await withTenantAction(async ({ tx }) => {
      // Buscar food para snapshot version + cálculos
      const food = await tx.food.findFirst({
        where: { id: parsed.data.foodId, isActive: true },
        select: {
          id: true,
          version: true,
          kcalPer100g: true,
          proteinG: true,
          carbG: true,
          fatG: true,
        },
      });
      if (!food) throw new Error("Alimento não encontrado");

      const factor = parsed.data.quantityG / 100;
      const kcal = food.kcalPer100g ? Number(food.kcalPer100g) * factor : null;
      const protein = food.proteinG ? Number(food.proteinG) * factor : null;
      const carb = food.carbG ? Number(food.carbG) * factor : null;
      const fat = food.fatG ? Number(food.fatG) * factor : null;

      // Contar ordem
      const count = await tx.mealItem.count({
        where: { mealId: parsed.data.mealId },
      });

      return tx.mealItem.create({
        data: {
          mealId: parsed.data.mealId,
          foodId: food.id,
          foodVersion: food.version, // Lock 15 snapshot
          quantityG: parsed.data.quantityG,
          preparationNotes: parsed.data.preparationNotes ?? null,
          sortOrder: count,
          kcal: kcal ? Math.round(kcal * 100) / 100 : null,
          proteinG: protein ? Math.round(protein * 100) / 100 : null,
          carbG: carb ? Math.round(carb * 100) / 100 : null,
          fatG: fat ? Math.round(fat * 100) / 100 : null,
        },
      });
    });

    return { ok: true, itemId: item.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function removeMealItemAction(
  itemId: string,
): Promise<{ ok: boolean }> {
  try {
    await withTenantAction(async ({ tx }) => {
      await tx.mealItem.delete({ where: { id: itemId } });
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Adiciona uma nova refeição a um dia do plano.
 * sortOrder = contagem atual de refeições no dia (append).
 */
export async function addMealToDayAction(input: {
  mealPlanDayId: string;
  name: string;
  scheduledTime?: string;
}): Promise<{ ok: boolean; mealId?: string; message?: string }> {
  const name = input.name.trim();
  if (!name || name.length < 1) {
    return { ok: false, message: "Nome é obrigatório" };
  }
  if (name.length > 80) {
    return { ok: false, message: "Nome muito longo (máx. 80 caracteres)" };
  }
  // Basic HH:MM validation
  const time = input.scheduledTime?.trim();
  if (time && !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, message: "Horário inválido (use HH:MM)" };
  }

  try {
    const meal = await withTenantAction(async ({ tx }) => {
      const day = await tx.mealPlanDay.findFirst({
        where: { id: input.mealPlanDayId },
        select: { id: true },
      });
      if (!day) throw new Error("Dia não encontrado");

      const count = await tx.meal.count({
        where: { mealPlanDayId: input.mealPlanDayId },
      });

      return tx.meal.create({
        data: {
          mealPlanDayId: input.mealPlanDayId,
          name,
          scheduledTime: time || null,
          sortOrder: count,
        },
      });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true, mealId: meal.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erro ao adicionar refeição",
    };
  }
}

/**
 * Remove uma refeição e todos os seus itens (cascade).
 */
export async function deleteMealAction(
  mealId: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await withTenantAction(async ({ tx }) => {
      const meal = await tx.meal.findFirst({
        where: { id: mealId },
        select: { id: true },
      });
      if (!meal) throw new Error("Refeição não encontrada");

      await tx.meal.delete({ where: { id: mealId } });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao remover refeição",
    };
  }
}

/**
 * Updates the scheduledTime of a meal (HH:MM or null to clear).
 */
export async function updateMealScheduledTimeAction(input: {
  mealId: string;
  scheduledTime: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const time = input.scheduledTime?.trim() || null;
  if (time && !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, message: "Horário inválido (use HH:MM)" };
  }

  try {
    await withTenantAction(async ({ tx }) => {
      const meal = await tx.meal.findFirst({
        where: { id: input.mealId },
        select: { id: true },
      });
      if (!meal) throw new Error("Refeição não encontrada");

      await tx.meal.update({
        where: { id: input.mealId },
        data: { scheduledTime: time },
      });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao atualizar horário",
    };
  }
}

/**
 * Adiciona um novo dia ao plano alimentar.
 * O rótulo padrão é "Dia N" onde N é o número de dias existentes + 1.
 * O novo dia começa sem refeições — o nutricionista pode adicionar via UI.
 */
export async function addDayToMealPlanAction(input: {
  mealPlanId: string;
}): Promise<{ ok: boolean; dayId?: string; message?: string }> {
  try {
    const day = await withTenantAction(async ({ tx }) => {
      const plan = await tx.mealPlan.findFirst({
        where: { id: input.mealPlanId },
        select: { id: true },
      });
      if (!plan) throw new Error("Plano não encontrado");

      const count = await tx.mealPlanDay.count({
        where: { mealPlanId: input.mealPlanId },
      });

      return tx.mealPlanDay.create({
        data: {
          mealPlanId: input.mealPlanId,
          dayLabel: `Dia ${count + 1}`,
          sortOrder: count,
        },
      });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true, dayId: day.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao adicionar dia",
    };
  }
}

/**
 * Remove um dia do plano alimentar e cascateia para meals + items.
 */
export async function deleteMealPlanDayAction(
  dayId: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await withTenantAction(async ({ tx }) => {
      const day = await tx.mealPlanDay.findFirst({
        where: { id: dayId },
        select: { id: true, mealPlanId: true },
      });
      if (!day) throw new Error("Dia não encontrado");

      // Guard: must not be the last day
      const count = await tx.mealPlanDay.count({
        where: { mealPlanId: day.mealPlanId },
      });
      if (count <= 1) {
        throw new Error("Não é possível remover o único dia do plano");
      }

      await tx.mealPlanDay.delete({ where: { id: dayId } });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao remover dia",
    };
  }
}

const UpdateItemQtySchema = z.object({
  itemId: z.string().uuid(),
  quantityG: z.coerce.number().positive().max(5000),
});

/**
 * Recalculates macros from the current food snapshot and updates the item.
 * Uses the snapshotted foodId to look up the food's per-100g values (Lock 15:
 * macros are stored on MealItem but the food's kcal/protein/carb/fat values are
 * used for recalculation — this is safe because the item still references the
 * same foodId and version; only quantity changed).
 */
export async function updateMealItemQuantityAction(input: {
  itemId: string;
  quantityG: number;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = UpdateItemQtySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Quantidade inválida" };

  try {
    await withTenantAction(async ({ tx }) => {
      // Fetch item to get foodId
      const item = await tx.mealItem.findFirst({
        where: { id: parsed.data.itemId },
        select: { id: true, foodId: true },
      });
      if (!item) throw new Error("Item não encontrado");

      // Fetch current food macros for recalculation
      const food = await tx.food.findFirst({
        where: { id: item.foodId },
        select: {
          kcalPer100g: true,
          proteinG: true,
          carbG: true,
          fatG: true,
        },
      });
      if (!food) throw new Error("Alimento não encontrado");

      const factor = parsed.data.quantityG / 100;
      const kcal = food.kcalPer100g ? Number(food.kcalPer100g) * factor : null;
      const protein = food.proteinG ? Number(food.proteinG) * factor : null;
      const carb = food.carbG ? Number(food.carbG) * factor : null;
      const fat = food.fatG ? Number(food.fatG) * factor : null;

      await tx.mealItem.update({
        where: { id: parsed.data.itemId },
        data: {
          quantityG: parsed.data.quantityG,
          kcal: kcal ? Math.round(kcal * 100) / 100 : null,
          proteinG: protein ? Math.round(protein * 100) / 100 : null,
          carbG: carb ? Math.round(carb * 100) / 100 : null,
          fatG: fat ? Math.round(fat * 100) / 100 : null,
        },
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao atualizar",
    };
  }
}

export async function searchFoodsAction(input: {
  query: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  foods?: Array<{ id: string; name: string; source: string }>;
  message?: string;
}> {
  if (input.query.length < 2) return { ok: true, foods: [] };

  try {
    const foods = await withTenantAction(async ({ tx }) => {
      return tx.food.findMany({
        where: {
          isActive: true,
          name: { contains: input.query, mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        take: input.limit ?? 20,
        select: { id: true, name: true, source: true },
      });
    });
    return { ok: true, foods };
  } catch {
    return { ok: false, message: "Erro na busca" };
  }
}

export async function updateMealPlanStatusAction(input: {
  mealPlanId: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "REPLACED" | "ARCHIVED";
}): Promise<PlanActionResult> {
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      await tx.mealPlan.update({
        where: { id: input.mealPlanId },
        data: { status: input.status },
      });

      // CORREÇÃO QA #73: appendAuditLog helper.
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: `meal_plan.status.${input.status.toLowerCase()}`,
        entityType: "MealPlan",
        entityId: input.mealPlanId,
        patientId: null,
        fieldsAccessed: ["status"],
        payload: { status: input.status },
      });
    });
    return { ok: true, mealPlanId: input.mealPlanId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

/**
 * Duplica um plano alimentar inteiro (deep copy: days → meals → items).
 * Novo plano começa como DRAFT com o nome fornecido.
 * Snapshots de foodVersion + macros são preservados (Lock 15).
 */
export async function duplicateMealPlanAction(input: {
  planId: string;
  newName: string;
  patientId: string;
}): Promise<PlanActionResult> {
  const name = input.newName.trim();
  if (!name || name.length < 2 || name.length > 120) {
    return { ok: false, message: "Nome inválido (2-120 caracteres)" };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // 1. Fetch source plan with full tree
        const source = await tx.mealPlan.findFirst({
          where: {
            id: input.planId,
            organizationId,
            patientId: input.patientId,
          },
          include: {
            days: {
              orderBy: { sortOrder: "asc" },
              include: {
                meals: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    items: { orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        });
        if (!source) throw new Error("Plano não encontrado");

        // 2. New plan (DRAFT)
        const newPlan = await tx.mealPlan.create({
          data: {
            organizationId,
            patientId: input.patientId,
            prescribedByUserId: userId,
            name,
            status: "DRAFT",
            startDate: source.startDate,
            endDate: source.endDate,
            targetKcal: source.targetKcal,
          },
        });

        // 3. Deep copy days → meals → items
        // Cast to any[] because Prisma's 4-level deep include type doesn't
        // fully infer inside withTenantAction under Next.js build checker.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const day of source.days as any[]) {
          const newDay = await tx.mealPlanDay.create({
            data: {
              mealPlanId: newPlan.id,
              dayLabel: day.dayLabel as string,
              sortOrder: day.sortOrder as number,
              notes: day.notes as string | null,
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const meal of day.meals as any[]) {
            const newMeal = await tx.meal.create({
              data: {
                mealPlanDayId: newDay.id,
                name: meal.name as string,
                scheduledTime: meal.scheduledTime as string | null,
                sortOrder: meal.sortOrder as number,
                notes: meal.notes as string | null,
              },
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const items = meal.items as any[];
            if (items.length > 0) {
              await tx.mealItem.createMany({
                data: items.map((item) => ({
                  mealId: newMeal.id,
                  foodId: item.foodId as string,
                  foodVersion: item.foodVersion as number, // Lock 15 snapshot preserved
                  quantityG: item.quantityG,
                  preparationNotes: item.preparationNotes as string | null,
                  sortOrder: item.sortOrder as number,
                  kcal: item.kcal,
                  proteinG: item.proteinG,
                  carbG: item.carbG,
                  fatG: item.fatG,
                })),
              });
            }
          }
        }

        // CORREÇÃO QA #73: appendAuditLog helper.
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "meal_plan.duplicate",
          entityType: "MealPlan",
          entityId: newPlan.id,
          patientId: input.patientId,
          fieldsAccessed: ["name", "sourceId"],
          payload: { sourceId: input.planId },
        });

        return newPlan;
      },
    );

    revalidatePath(`/app/patients/${input.patientId}/meal-plans`);
    return { ok: true, mealPlanId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao duplicar",
    };
  }
}

/**
 * Persiste a nova ordem dos MealItems dentro de uma Meal.
 * Recebe os IDs na nova ordem; atualiza sortOrder = índice.
 */
export async function reorderMealItemsAction(input: {
  mealId: string;
  orderedIds: string[];
}): Promise<PlanActionResult> {
  try {
    await withTenantAction(async ({ tx }) => {
      // CORREÇÃO: serializado (pg adapter dentro de tx não suporta paralelo).
      for (let index = 0; index < input.orderedIds.length; index++) {
        await tx.mealItem.update({
          where: { id: input.orderedIds[index]! },
          data: { sortOrder: index },
        });
      }
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

/**
 * Persiste a nova ordem das Meals dentro de um MealPlanDay.
 */
export async function reorderMealsAction(input: {
  mealPlanDayId: string;
  orderedIds: string[];
}): Promise<PlanActionResult> {
  try {
    await withTenantAction(async ({ tx }) => {
      // CORREÇÃO: serializado (pg adapter dentro de tx não suporta paralelo).
      for (let index = 0; index < input.orderedIds.length; index++) {
        await tx.meal.update({
          where: { id: input.orderedIds[index]! },
          data: { sortOrder: index },
        });
      }
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

/**
 * Renomeia o rótulo de um dia do plano alimentar (ex: "Dia 1" → "Segunda-feira").
 * Máx 60 caracteres; string vazia não é aceita.
 */
export async function updateMealPlanDayLabelAction(input: {
  dayId: string;
  dayLabel: string;
}): Promise<{ ok: boolean; message?: string }> {
  const label = input.dayLabel.trim();
  if (!label || label.length < 1) {
    return { ok: false, message: "Rótulo não pode ser vazio" };
  }
  if (label.length > 60) {
    return { ok: false, message: "Rótulo muito longo (máx. 60 caracteres)" };
  }
  if (!input.dayId) return { ok: false, message: "Dia inválido" };

  try {
    await withTenantAction(async ({ tx }) => {
      const day = await tx.mealPlanDay.findFirst({
        where: { id: input.dayId },
        select: { id: true },
      });
      if (!day) throw new Error("Dia não encontrado");

      await tx.mealPlanDay.update({
        where: { id: input.dayId },
        data: { dayLabel: label },
      });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao renomear o dia",
    };
  }
}

/**
 * Renomeia uma refeição dentro de um dia do plano alimentar.
 * Máx 80 caracteres; string vazia não é aceita.
 */
export async function updateMealNameAction(input: {
  mealId: string;
  name: string;
}): Promise<{ ok: boolean; message?: string }> {
  const name = input.name.trim();
  if (!name || name.length < 1) {
    return { ok: false, message: "Nome não pode ser vazio" };
  }
  if (name.length > 80) {
    return { ok: false, message: "Nome muito longo (máx. 80 caracteres)" };
  }
  if (!input.mealId) return { ok: false, message: "Refeição inválida" };

  try {
    await withTenantAction(async ({ tx }) => {
      const meal = await tx.meal.findFirst({
        where: { id: input.mealId },
        select: { id: true },
      });
      if (!meal) throw new Error("Refeição não encontrada");

      await tx.meal.update({
        where: { id: input.mealId },
        data: { name },
      });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao renomear refeição",
    };
  }
}

/**
 * Atualiza as notas de preparo de um MealItem.
 * String vazia → null (remove as notas). Máx 500 caracteres.
 */
export async function updateMealItemNotesAction(input: {
  itemId: string;
  notes: string;
}): Promise<{ ok: boolean; message?: string }> {
  const notes = input.notes.trim();
  if (notes.length > 500) {
    return { ok: false, message: "Nota muito longa (máx. 500 caracteres)" };
  }
  if (!input.itemId) return { ok: false, message: "Item inválido" };

  try {
    await withTenantAction(async ({ tx }) => {
      const item = await tx.mealItem.findFirst({
        where: { id: input.itemId },
        select: { id: true },
      });
      if (!item) throw new Error("Item não encontrado");

      await tx.mealItem.update({
        where: { id: input.itemId },
        data: { preparationNotes: notes || null },
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao salvar nota",
    };
  }
}

/**
 * Updates the plan's name and/or targetKcal.
 * Either field is optional — omit to leave unchanged.
 */
export async function updateMealPlanMetaAction(input: {
  planId: string;
  name?: string;
  targetKcal?: number | null;
}): Promise<{ ok: boolean; message?: string }> {
  const name = input.name?.trim();
  if (name !== undefined) {
    if (!name || name.length < 2) {
      return { ok: false, message: "Nome muito curto (mín. 2 caracteres)" };
    }
    if (name.length > 120) {
      return { ok: false, message: "Nome muito longo (máx. 120 caracteres)" };
    }
  }
  if (input.targetKcal !== undefined && input.targetKcal !== null) {
    if (input.targetKcal < 600 || input.targetKcal > 6000) {
      return {
        ok: false,
        message: "Meta calórica deve estar entre 600 e 6000 kcal",
      };
    }
  }

  const data: { name?: string; targetKcal?: number | null } = {};
  if (name !== undefined) data.name = name;
  if ("targetKcal" in input) data.targetKcal = input.targetKcal ?? null;
  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await withTenantAction(async ({ tx }) => {
      const plan = await tx.mealPlan.findFirst({
        where: { id: input.planId },
        select: { id: true },
      });
      if (!plan) throw new Error("Plano não encontrado");

      await tx.mealPlan.update({
        where: { id: input.planId },
        data,
      });
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao atualizar o plano",
    };
  }
}
