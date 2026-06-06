"use server";

// Editor de receitas (Recipe + RecipeIngredient). Tenant-scoped (withTenant).
// Receita = lista de alimentos com quantidade; totais calculados dos
// ingredientes (food per-100g * qty/100). Lock 15: foodVersion snapshot.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RecipeActionResult {
  ok: boolean;
  message?: string;
  recipeId?: string;
}

export interface RecipeSummary {
  id: string;
  name: string;
  description: string | null;
  servings: number;
  ingredientCount: number;
  totalKcal: number | null;
  perServingKcal: number | null;
}

export interface RecipeIngredientView {
  id: string;
  foodId: string;
  foodName: string;
  quantityG: number;
  kcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
}

export interface RecipeDetail {
  id: string;
  name: string;
  description: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  totalKcal: number | null;
  totalProteinG: number | null;
  totalCarbG: number | null;
  totalFatG: number | null;
  ingredients: RecipeIngredientView[];
}

const round2 = (v: number | null) =>
  v != null ? Math.round(v * 100) / 100 : null;

// Recalcula e persiste os totais da receita a partir dos ingredientes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recomputeRecipeTotals(tx: any, recipeId: string): Promise<void> {
  const items = await tx.recipeIngredient.findMany({
    where: { recipeId },
    select: {
      quantityG: true,
      food: {
        select: { kcalPer100g: true, proteinG: true, carbG: true, fatG: true },
      },
    },
  });
  let kcal = 0,
    p = 0,
    c = 0,
    f = 0;
  for (const it of items as Array<{
    quantityG: unknown;
    food: {
      kcalPer100g: unknown;
      proteinG: unknown;
      carbG: unknown;
      fatG: unknown;
    } | null;
  }>) {
    const factor = Number(it.quantityG) / 100;
    if (it.food?.kcalPer100g) kcal += Number(it.food.kcalPer100g) * factor;
    if (it.food?.proteinG) p += Number(it.food.proteinG) * factor;
    if (it.food?.carbG) c += Number(it.food.carbG) * factor;
    if (it.food?.fatG) f += Number(it.food.fatG) * factor;
  }
  await tx.recipe.update({
    where: { id: recipeId },
    data: {
      totalKcal: round2(kcal),
      totalProteinG: round2(p),
      totalCarbG: round2(c),
      totalFatG: round2(f),
    },
  });
}

const CreateRecipeSchema = z.object({
  name: z.string().min(2).max(160).trim(),
  description: z.string().max(1000).optional().or(z.literal("")),
  servings: z.coerce.number().int().min(1).max(100).default(1),
  prepTimeMinutes: z.coerce.number().int().min(0).max(1440).optional(),
});

export async function createRecipeAction(input: {
  name: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
}): Promise<RecipeActionResult> {
  const parsed = CreateRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }
  const d = parsed.data;
  try {
    const recipe = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const r = await tx.recipe.create({
          data: {
            organizationId,
            createdByUserId: userId,
            name: d.name,
            description: d.description || null,
            servings: d.servings,
            prepTimeMinutes: d.prepTimeMinutes ?? null,
          },
        });
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "recipe.create",
          entityType: "Recipe",
          entityId: r.id,
          patientId: null,
          fieldsAccessed: ["name"],
          payload: {},
        });
        return r;
      },
    );
    revalidatePath("/app/recipes");
    return { ok: true, recipeId: recipe.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function listRecipesAction(): Promise<RecipeSummary[]> {
  try {
    return await withTenantAction(async ({ tx }) => {
      const rows = await tx.recipe.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        take: 200,
        select: {
          id: true,
          name: true,
          description: true,
          servings: true,
          totalKcal: true,
          _count: { select: { ingredients: true } },
        },
      });
      return rows.map(
        (r: {
          id: string;
          name: string;
          description: string | null;
          servings: number;
          totalKcal: { toString(): string } | null;
          _count: { ingredients: number };
        }) => {
          const total = r.totalKcal != null ? Number(r.totalKcal) : null;
          return {
            id: r.id,
            name: r.name,
            description: r.description,
            servings: r.servings,
            ingredientCount: r._count.ingredients,
            totalKcal: total,
            perServingKcal:
              total != null && r.servings > 0
                ? Math.round(total / r.servings)
                : null,
          };
        },
      );
    });
  } catch {
    return [];
  }
}

export async function getRecipeAction(
  recipeId: string,
): Promise<RecipeDetail | null> {
  if (!recipeId || !UUID_REGEX.test(recipeId)) return null;
  try {
    return await withTenantAction(async ({ tx }) => {
      const r = await tx.recipe.findFirst({
        where: { id: recipeId },
        select: {
          id: true,
          name: true,
          description: true,
          servings: true,
          prepTimeMinutes: true,
          totalKcal: true,
          totalProteinG: true,
          totalCarbG: true,
          totalFatG: true,
          ingredients: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              foodId: true,
              quantityG: true,
              food: {
                select: {
                  name: true,
                  kcalPer100g: true,
                  proteinG: true,
                  carbG: true,
                  fatG: true,
                },
              },
            },
          },
        },
      });
      if (!r) return null;
      const num = (v: { toString(): string } | null) =>
        v != null ? Number(v.toString()) : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ingredients: RecipeIngredientView[] = (r.ingredients as any[]).map(
        (i) => {
          const factor = Number(i.quantityG) / 100;
          const fkcal = i.food?.kcalPer100g
            ? Number(i.food.kcalPer100g) * factor
            : null;
          const fp = i.food?.proteinG ? Number(i.food.proteinG) * factor : null;
          const fc = i.food?.carbG ? Number(i.food.carbG) * factor : null;
          const ff = i.food?.fatG ? Number(i.food.fatG) * factor : null;
          return {
            id: i.id,
            foodId: i.foodId,
            foodName: i.food?.name ?? "—",
            quantityG: Number(i.quantityG),
            kcal: round2(fkcal),
            proteinG: round2(fp),
            carbG: round2(fc),
            fatG: round2(ff),
          };
        },
      );
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        servings: r.servings,
        prepTimeMinutes: r.prepTimeMinutes,
        totalKcal: num(r.totalKcal),
        totalProteinG: num(r.totalProteinG),
        totalCarbG: num(r.totalCarbG),
        totalFatG: num(r.totalFatG),
        ingredients,
      };
    });
  } catch {
    return null;
  }
}

const AddIngredientSchema = z.object({
  recipeId: z.string().uuid(),
  foodId: z.string().uuid(),
  quantityG: z.coerce.number().positive().max(50000),
});

export async function addRecipeIngredientAction(input: {
  recipeId: string;
  foodId: string;
  quantityG: number;
}): Promise<RecipeActionResult> {
  const parsed = AddIngredientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos" };
  const d = parsed.data;
  try {
    await withTenantAction(async ({ tx, organizationId }) => {
      const recipe = await tx.recipe.findFirst({
        where: { id: d.recipeId, organizationId },
        select: { id: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");
      const food = await tx.food.findFirst({
        where: { id: d.foodId, isActive: true },
        select: { id: true, version: true },
      });
      if (!food) throw new Error("Alimento não encontrado");
      const count = await tx.recipeIngredient.count({
        where: { recipeId: d.recipeId },
      });
      await tx.recipeIngredient.create({
        data: {
          recipeId: d.recipeId,
          foodId: food.id,
          foodVersion: food.version, // Lock 15
          quantityG: d.quantityG,
          sortOrder: count,
        },
      });
      await recomputeRecipeTotals(tx, d.recipeId);
    });
    revalidatePath(`/app/recipes/${d.recipeId}`);
    return { ok: true, recipeId: d.recipeId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function removeRecipeIngredientAction(input: {
  ingredientId: string;
  recipeId: string;
}): Promise<RecipeActionResult> {
  if (!input.ingredientId || !UUID_REGEX.test(input.ingredientId)) {
    return { ok: false, message: "Ingrediente inválido" };
  }
  try {
    await withTenantAction(async ({ tx, organizationId }) => {
      // Confirma que a receita é da org (defense-in-depth) antes de mexer.
      const recipe = await tx.recipe.findFirst({
        where: { id: input.recipeId, organizationId },
        select: { id: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");
      await tx.recipeIngredient.deleteMany({
        where: { id: input.ingredientId, recipeId: input.recipeId },
      });
      await recomputeRecipeTotals(tx, input.recipeId);
    });
    revalidatePath(`/app/recipes/${input.recipeId}`);
    return { ok: true, recipeId: input.recipeId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function deleteRecipeAction(
  recipeId: string,
): Promise<RecipeActionResult> {
  if (!recipeId || !UUID_REGEX.test(recipeId)) {
    return { ok: false, message: "Receita inválida" };
  }
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const deleted = await tx.recipe.deleteMany({
        where: { id: recipeId, organizationId },
      });
      if (deleted.count === 0) throw new Error("Receita não encontrada");
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "recipe.delete",
        entityType: "Recipe",
        entityId: recipeId,
        patientId: null,
        fieldsAccessed: ["id"],
        payload: {},
      });
    });
    revalidatePath("/app/recipes");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}
