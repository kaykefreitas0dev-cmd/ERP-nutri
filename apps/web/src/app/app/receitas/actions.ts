"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recomputes totalKcal/Protein/Carb/Fat for a recipe from its ingredients.
 * Must be called inside a `withTenantAction` transaction.
 */
async function recomputeRecipeTotals(
  tx: Parameters<Parameters<typeof withTenantAction>[0]>[0]["tx"],
  recipeId: string,
) {
  const ings = await tx.recipeIngredient.findMany({
    where: { recipeId },
    include: {
      food: {
        select: {
          kcalPer100g: true,
          proteinG: true,
          carbG: true,
          fatG: true,
        },
      },
    },
  });

  let kcal = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;

  for (const ing of ings) {
    const f = ing.quantityG.toNumber() / 100;
    kcal += (ing.food.kcalPer100g?.toNumber() ?? 0) * f;
    protein += (ing.food.proteinG?.toNumber() ?? 0) * f;
    carb += (ing.food.carbG?.toNumber() ?? 0) * f;
    fat += (ing.food.fatG?.toNumber() ?? 0) * f;
  }

  await tx.recipe.update({
    where: { id: recipeId },
    data: {
      totalKcal: Math.round(kcal * 100) / 100,
      totalProteinG: Math.round(protein * 100) / 100,
      totalCarbG: Math.round(carb * 100) / 100,
      totalFatG: Math.round(fat * 100) / 100,
    },
  });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listRecipesAction(input: { q?: string }): Promise<{
  ok: boolean;
  recipes?: Array<{
    id: string;
    name: string;
    description: string | null;
    servings: number;
    prepTimeMinutes: number | null;
    totalKcal: string | null;
    totalProteinG: string | null;
    totalCarbG: string | null;
    totalFatG: string | null;
    ingredientCount: number;
    createdAt: string;
  }>;
  message?: string;
}> {
  try {
    const recipes = await withTenantAction(async ({ tx }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input.q && input.q.trim().length >= 2) {
        where.name = { contains: input.q.trim(), mode: "insensitive" };
      }
      return tx.recipe.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 200,
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
          createdAt: true,
          _count: { select: { ingredients: true } },
        },
      });
    });

    return {
      ok: true,
      recipes: (
        recipes as Array<{
          id: string;
          name: string;
          description: string | null;
          servings: number;
          prepTimeMinutes: number | null;
          totalKcal: { toString: () => string } | null;
          totalProteinG: { toString: () => string } | null;
          totalCarbG: { toString: () => string } | null;
          totalFatG: { toString: () => string } | null;
          createdAt: Date;
          _count: { ingredients: number };
        }>
      ).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        servings: r.servings,
        prepTimeMinutes: r.prepTimeMinutes,
        totalKcal: r.totalKcal?.toString() ?? null,
        totalProteinG: r.totalProteinG?.toString() ?? null,
        totalCarbG: r.totalCarbG?.toString() ?? null,
        totalFatG: r.totalFatG?.toString() ?? null,
        ingredientCount: r._count.ingredients,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return { ok: false, message: "Erro ao carregar receitas" };
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const CreateRecipeSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  description: z.string().max(500).trim().optional().or(z.literal("")),
  servings: z.coerce.number().int().min(1).max(100).default(1),
  prepTimeMinutes: z.coerce.number().int().min(1).max(600).optional(),
  notes: z.string().max(1000).trim().optional().or(z.literal("")),
});

export async function createRecipeAction(
  formData: FormData,
): Promise<{ ok: boolean; recipeId?: string; message?: string }> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateRecipeSchema.safeParse(raw);
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
            notes: d.notes || null,
          },
          select: { id: true },
        });

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'recipe.create'::text,
            'Recipe'::text,
            ${r.id}::text, NULL::uuid,
            ARRAY['name','servings']::text[], '{}'::jsonb
          )
        `;

        return r;
      },
    );

    revalidatePath("/app/receitas");
    return { ok: true, recipeId: recipe.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao criar receita",
    };
  }
}

// ---------------------------------------------------------------------------
// Get detail (with ingredients + food data)
// ---------------------------------------------------------------------------

export async function getRecipeDetailAction(input: {
  recipeId: string;
}): Promise<{
  ok: boolean;
  recipe?: {
    id: string;
    name: string;
    description: string | null;
    servings: number;
    prepTimeMinutes: number | null;
    notes: string | null;
    totalKcal: string | null;
    totalProteinG: string | null;
    totalCarbG: string | null;
    totalFatG: string | null;
    ingredients: Array<{
      id: string;
      foodId: string;
      foodVersion: number;
      foodName: string;
      foodSource: string;
      quantityG: string;
      notes: string | null;
      sortOrder: number;
      kcalPer100g: string | null;
      proteinG: string | null;
      carbG: string | null;
      fatG: string | null;
    }>;
  };
  message?: string;
}> {
  try {
    const recipe = await withTenantAction(async ({ tx, organizationId }) => {
      return tx.recipe.findFirst({
        where: { id: input.recipeId, organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          servings: true,
          prepTimeMinutes: true,
          notes: true,
          totalKcal: true,
          totalProteinG: true,
          totalCarbG: true,
          totalFatG: true,
          ingredients: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              foodId: true,
              foodVersion: true,
              quantityG: true,
              notes: true,
              sortOrder: true,
              food: {
                select: {
                  name: true,
                  source: true,
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
    });

    if (!recipe) return { ok: false, message: "Receita não encontrada" };

    return {
      ok: true,
      recipe: {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes,
        notes: recipe.notes,
        totalKcal: recipe.totalKcal?.toString() ?? null,
        totalProteinG: recipe.totalProteinG?.toString() ?? null,
        totalCarbG: recipe.totalCarbG?.toString() ?? null,
        totalFatG: recipe.totalFatG?.toString() ?? null,
        ingredients: (
          recipe.ingredients as Array<{
            id: string;
            foodId: string;
            foodVersion: number;
            quantityG: { toString: () => string };
            notes: string | null;
            sortOrder: number;
            food: {
              name: string;
              source: string;
              kcalPer100g: { toString: () => string } | null;
              proteinG: { toString: () => string } | null;
              carbG: { toString: () => string } | null;
              fatG: { toString: () => string } | null;
            };
          }>
        ).map((ing) => ({
          id: ing.id,
          foodId: ing.foodId,
          foodVersion: ing.foodVersion,
          foodName: ing.food.name,
          foodSource: ing.food.source,
          quantityG: ing.quantityG.toString(),
          notes: ing.notes,
          sortOrder: ing.sortOrder,
          kcalPer100g: ing.food.kcalPer100g?.toString() ?? null,
          proteinG: ing.food.proteinG?.toString() ?? null,
          carbG: ing.food.carbG?.toString() ?? null,
          fatG: ing.food.fatG?.toString() ?? null,
        })),
      },
    };
  } catch {
    return { ok: false, message: "Erro ao carregar receita" };
  }
}

// ---------------------------------------------------------------------------
// Search foods (for ingredient picker)
// ---------------------------------------------------------------------------

export async function searchFoodsForRecipeAction(input: {
  query: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  foods?: Array<{
    id: string;
    name: string;
    source: string;
    version: number;
    kcalPer100g: string | null;
    proteinG: string | null;
    carbG: string | null;
    fatG: string | null;
  }>;
  message?: string;
}> {
  if (input.query.trim().length < 2) return { ok: true, foods: [] };

  try {
    const foods = await withTenantAction(async ({ tx }) => {
      return tx.food.findMany({
        where: {
          isActive: true,
          name: { contains: input.query.trim(), mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        take: input.limit ?? 20,
        select: {
          id: true,
          name: true,
          source: true,
          version: true,
          kcalPer100g: true,
          proteinG: true,
          carbG: true,
          fatG: true,
        },
      });
    });

    return {
      ok: true,
      foods: (
        foods as Array<{
          id: string;
          name: string;
          source: string;
          version: number;
          kcalPer100g: { toString: () => string } | null;
          proteinG: { toString: () => string } | null;
          carbG: { toString: () => string } | null;
          fatG: { toString: () => string } | null;
        }>
      ).map((f) => ({
        id: f.id,
        name: f.name,
        source: f.source,
        version: f.version,
        kcalPer100g: f.kcalPer100g?.toString() ?? null,
        proteinG: f.proteinG?.toString() ?? null,
        carbG: f.carbG?.toString() ?? null,
        fatG: f.fatG?.toString() ?? null,
      })),
    };
  } catch {
    return { ok: false, message: "Erro na busca de alimentos" };
  }
}

// ---------------------------------------------------------------------------
// Add ingredient
// ---------------------------------------------------------------------------

const AddIngredientSchema = z.object({
  recipeId: z.string().uuid(),
  foodId: z.string().uuid(),
  foodVersion: z.coerce.number().int().min(1),
  quantityG: z.coerce.number().positive().max(10000),
  notes: z.string().max(200).trim().optional().or(z.literal("")),
});

export async function addIngredientAction(input: {
  recipeId: string;
  foodId: string;
  foodVersion: number;
  quantityG: number;
  notes?: string;
}): Promise<{ ok: boolean; ingredientId?: string; message?: string }> {
  const parsed = AddIngredientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos" };
  }

  const d = parsed.data;

  try {
    const ingredientId = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // Verify recipe belongs to org
        const recipe = await tx.recipe.findFirst({
          where: { id: d.recipeId, organizationId, isActive: true },
          select: { id: true },
        });
        if (!recipe) throw new Error("Receita não encontrada");

        // Verify food exists
        const food = await tx.food.findFirst({
          where: { id: d.foodId, isActive: true },
          select: { id: true, version: true },
        });
        if (!food) throw new Error("Alimento não encontrado");

        // Get current max sortOrder
        const existing = await tx.recipeIngredient.aggregate({
          where: { recipeId: d.recipeId },
          _max: { sortOrder: true },
        });
        const nextSort = (existing._max.sortOrder ?? -1) + 1;

        const ing = await tx.recipeIngredient.create({
          data: {
            recipeId: d.recipeId,
            foodId: d.foodId,
            foodVersion: d.foodVersion,
            quantityG: d.quantityG,
            notes: d.notes || null,
            sortOrder: nextSort,
          },
          select: { id: true },
        });

        // Recompute recipe totals
        await recomputeRecipeTotals(tx, d.recipeId);

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'recipe.ingredient.add'::text,
            'Recipe'::text,
            ${d.recipeId}::text, NULL::uuid,
            ARRAY['ingredients']::text[], '{}'::jsonb
          )
        `;

        return ing.id;
      },
    );

    revalidatePath(`/app/receitas/${d.recipeId}`);
    return { ok: true, ingredientId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erro ao adicionar ingrediente",
    };
  }
}

// ---------------------------------------------------------------------------
// Update ingredient quantity
// ---------------------------------------------------------------------------

export async function updateIngredientQtyAction(input: {
  ingredientId: string;
  recipeId: string;
  quantityG: number;
}): Promise<{ ok: boolean; message?: string }> {
  if (input.quantityG <= 0 || input.quantityG > 10000) {
    return { ok: false, message: "Quantidade inválida" };
  }

  try {
    await withTenantAction(async ({ tx, organizationId }) => {
      // Verify recipe belongs to org
      const recipe = await tx.recipe.findFirst({
        where: { id: input.recipeId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");

      await tx.recipeIngredient.update({
        where: { id: input.ingredientId },
        data: { quantityG: input.quantityG },
      });

      await recomputeRecipeTotals(tx, input.recipeId);
    });

    revalidatePath(`/app/receitas/${input.recipeId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erro ao atualizar quantidade",
    };
  }
}

// ---------------------------------------------------------------------------
// Remove ingredient
// ---------------------------------------------------------------------------

export async function removeIngredientAction(input: {
  ingredientId: string;
  recipeId: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const recipe = await tx.recipe.findFirst({
        where: { id: input.recipeId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");

      await tx.recipeIngredient.delete({
        where: { id: input.ingredientId },
      });

      await recomputeRecipeTotals(tx, input.recipeId);

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'recipe.ingredient.remove'::text,
          'Recipe'::text,
          ${input.recipeId}::text, NULL::uuid,
          ARRAY['ingredients']::text[], '{}'::jsonb
        )
      `;
    });

    revalidatePath(`/app/receitas/${input.recipeId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erro ao remover ingrediente",
    };
  }
}

// ---------------------------------------------------------------------------
// Archive (soft-delete)
// ---------------------------------------------------------------------------

export async function archiveRecipeAction(input: {
  recipeId: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const recipe = await tx.recipe.findFirst({
        where: { id: input.recipeId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");

      await tx.recipe.update({
        where: { id: input.recipeId },
        data: { isActive: false },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'recipe.archive'::text,
          'Recipe'::text,
          ${input.recipeId}::text, NULL::uuid,
          ARRAY['isActive']::text[], '{}'::jsonb
        )
      `;
    });

    revalidatePath("/app/receitas");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao arquivar receita",
    };
  }
}

// ---------------------------------------------------------------------------
// Update recipe name/description/servings/notes
// ---------------------------------------------------------------------------

const UpdateRecipeMetaSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  description: z.string().max(500).trim().optional().or(z.literal("")),
  servings: z.coerce.number().int().min(1).max(100).optional(),
  prepTimeMinutes: z.coerce.number().int().min(1).max(600).optional(),
  notes: z.string().max(1000).trim().optional().or(z.literal("")),
});

export async function updateRecipeMetaAction(input: {
  recipeId: string;
  name?: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number | null;
  notes?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { recipeId, ...rest } = input;
  const parsed = UpdateRecipeMetaSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos" };
  }

  try {
    await withTenantAction(async ({ tx, organizationId }) => {
      const recipe = await tx.recipe.findFirst({
        where: { id: recipeId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");

      const data: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.description !== undefined)
        data.description = parsed.data.description || null;
      if (parsed.data.servings !== undefined)
        data.servings = parsed.data.servings;
      if (input.prepTimeMinutes !== undefined)
        data.prepTimeMinutes = input.prepTimeMinutes;
      if (parsed.data.notes !== undefined)
        data.notes = parsed.data.notes || null;

      if (Object.keys(data).length > 0) {
        await tx.recipe.update({ where: { id: recipeId }, data });
      }
    });

    revalidatePath(`/app/receitas/${recipeId}`);
    revalidatePath("/app/receitas");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao atualizar receita",
    };
  }
}
