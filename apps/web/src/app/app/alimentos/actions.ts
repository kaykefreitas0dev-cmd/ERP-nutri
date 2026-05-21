"use server";

import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { revalidatePath } from "next/cache";

export type CustomFoodResult =
  | { ok: true; foodId: string }
  | { ok: false; message: string };

/**
 * Cria um alimento personalizado (source=CUSTOM) vinculado à organização.
 * Lock 15 — TRIGGER enforce_food_immutability impossibilita UPDATE posterior;
 * use a service de food-versioning se precisar corrigir valores.
 */
export async function createCustomFoodAction(
  formData: FormData,
): Promise<CustomFoodResult> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const brand = (formData.get("brand") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null)?.trim() || null;

  const parseDecimal = (key: string) => {
    const raw = (formData.get(key) as string | null)?.trim();
    if (!raw) return null;
    const n = parseFloat(raw);
    return isNaN(n) || n < 0 ? null : n;
  };

  const kcalPer100g = parseDecimal("kcalPer100g");
  const proteinG = parseDecimal("proteinG");
  const carbG = parseDecimal("carbG");
  const fatG = parseDecimal("fatG");
  const fiberG = parseDecimal("fiberG");

  if (!name || name.length < 2) {
    return { ok: false, message: "Nome deve ter pelo menos 2 caracteres" };
  }
  if (name.length > 120) {
    return { ok: false, message: "Nome muito longo (máx. 120 caracteres)" };
  }
  if (kcalPer100g !== null && (kcalPer100g < 0 || kcalPer100g > 10000)) {
    return { ok: false, message: "kcal inválido (0-10000)" };
  }

  try {
    const food = await withTenantAction(async ({ tx, organizationId }) => {
      // Check for duplicate name within this org's custom foods
      const existing = await tx.food.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          organizationId,
          source: "CUSTOM",
          isActive: true,
        },
        select: { id: true },
      });
      if (existing) {
        throw new Error(`Alimento "${name}" já existe na sua biblioteca`);
      }

      return tx.food.create({
        data: {
          organizationId,
          source: "CUSTOM",
          name,
          brand,
          category,
          kcalPer100g,
          proteinG,
          carbG,
          fatG,
          fiberG,
          version: 1,
          isActive: true,
        },
        select: { id: true },
      });
    });

    revalidatePath("/app/alimentos");
    return { ok: true, foodId: food.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao criar alimento",
    };
  }
}
