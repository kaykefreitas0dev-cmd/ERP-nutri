"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface TemplateStructureItem {
  kcal?: number | null;
}

interface TemplateStructureMeal {
  items?: TemplateStructureItem[];
}

interface TemplateStructureDay {
  meals?: TemplateStructureMeal[];
}

interface TemplateStructure {
  days?: TemplateStructureDay[];
  totalKcal?: number | null;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  targetKcal: number | null;
  usageCount: number;
  dayCount: number;
  totalKcal: number | null;
  createdAt: string;
}

function parseTemplateStats(structure: unknown): {
  dayCount: number;
  totalKcal: number | null;
} {
  const s = structure as TemplateStructure | null;
  const dayCount = s?.days?.length ?? 0;

  let totalKcal: number | null = null;
  if (s?.totalKcal != null) {
    totalKcal = Math.round(Number(s.totalKcal));
  } else if (s?.days) {
    let sum = 0;
    for (const day of s.days) {
      for (const meal of day.meals ?? []) {
        for (const item of meal.items ?? []) {
          if (item.kcal) sum += Number(item.kcal);
        }
      }
    }
    totalKcal = sum > 0 ? Math.round(sum) : null;
  }

  return { dayCount, totalKcal };
}

// ──────────────────────────────────────────────────────────────────────────────
// List all templates for the org
// ──────────────────────────────────────────────────────────────────────────────

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  targetKcal: { toNumber: () => number } | null;
  usageCount: number;
  structure: unknown;
  createdAt: Date;
};

export async function listTemplatesAction(): Promise<{
  ok: boolean;
  templates?: TemplateListItem[];
  message?: string;
}> {
  try {
    const rows = await withTenantAction(async ({ tx }) => {
      return tx.mealPlanTemplate.findMany({
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          description: true,
          targetKcal: true,
          usageCount: true,
          structure: true,
          createdAt: true,
        },
      }) as Promise<TemplateRow[]>;
    });

    const templates: TemplateListItem[] = rows.map((t: TemplateRow) => {
      const { dayCount, totalKcal } = parseTemplateStats(t.structure);
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        targetKcal: t.targetKcal ? Number(t.targetKcal) : null,
        usageCount: t.usageCount,
        dayCount,
        totalKcal,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return { ok: true, templates };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: "Erro ao listar modelos" };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Rename template
// ──────────────────────────────────────────────────────────────────────────────

const RenameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120).trim(),
});

export async function renameTemplateAction(input: {
  id: string;
  name: string;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = RenameSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Nome inválido (2–120 caracteres)" };

  try {
    await withTenantAction(async ({ tx }) => {
      const existing = await tx.mealPlanTemplate.findFirst({
        where: { id: parsed.data.id },
        select: { id: true },
      });
      if (!existing) throw new Error("Modelo não encontrado");

      await tx.mealPlanTemplate.update({
        where: { id: parsed.data.id },
        data: { name: parsed.data.name },
      });
    });
    revalidatePath("/app/modelos");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao renomear modelo",
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Delete template
// ──────────────────────────────────────────────────────────────────────────────

const DeleteSchema = z.object({ id: z.string().uuid() });

export async function deleteTemplateAction(input: {
  id: string;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "ID inválido" };

  try {
    await withTenantAction(async ({ tx }) => {
      const existing = await tx.mealPlanTemplate.findFirst({
        where: { id: parsed.data.id },
        select: { id: true },
      });
      if (!existing) throw new Error("Modelo não encontrado");

      await tx.mealPlanTemplate.delete({ where: { id: parsed.data.id } });
    });
    revalidatePath("/app/modelos");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao excluir modelo",
    };
  }
}
