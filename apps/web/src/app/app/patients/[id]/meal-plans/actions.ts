"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

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

        await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'meal_plan.create'::text, 'MealPlan'::text,
          ${plan.id}::text, ${d.patientId}::uuid,
          ARRAY['name','targetKcal']::text[],
          '{}'::jsonb
        )
      `;

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

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          ${`meal_plan.status.${input.status.toLowerCase()}`}::text,
          'MealPlan'::text,
          ${input.mealPlanId}::text, NULL::uuid,
          ARRAY['status']::text[], '{}'::jsonb
        )
      `;
    });
    return { ok: true, mealPlanId: input.mealPlanId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
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
      await Promise.all(
        input.orderedIds.map((id, index) =>
          tx.mealItem.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
      );
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
      await Promise.all(
        input.orderedIds.map((id, index) =>
          tx.meal.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
      );
    });
    revalidatePath("/app/patients/[id]/meal-plans/[planId]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}
