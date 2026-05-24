import { redirect } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { TemplatesClient } from "./TemplatesClient";
import type { TemplateListItem } from "./actions";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  targetKcal: { toNumber: () => number } | null;
  usageCount: number;
  structure: unknown;
  createdAt: Date;
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos de plano alimentar" };

interface TemplateStructureMeal {
  items?: Array<{ kcal?: number | null }>;
}

interface TemplateStructureDay {
  meals?: TemplateStructureMeal[];
}

interface TemplateStructure {
  days?: TemplateStructureDay[];
  totalKcal?: number | null;
}

function deriveStats(structure: unknown): {
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

export default async function ModelosPage() {
  let templates: TemplateListItem[] = [];

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
      }) as unknown as TemplateRow[];
    });

    templates = rows.map((t: TemplateRow) => {
      const { dayCount, totalKcal } = deriveStats(t.structure);
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        targetKcal: t.targetKcal ? Number(t.targetKcal) : null,
        usageCount: t.usageCount,
        dayCount,
        totalKcal,
        createdAt: t.createdAt.toISOString(),
      } satisfies TemplateListItem;
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Page header */}
        <div className="flex items-center gap-2.5">
          <LayoutTemplate
            className="h-5 w-5 text-brand-primary"
            strokeWidth={1.75}
          />
          <h1 className="text-h2 font-semibold text-text-primary">
            Modelos de plano alimentar
          </h1>
        </div>

        <p className="mt-1 text-body text-text-secondary">
          Estruturas de plano reutilizáveis. Para criar um modelo, abra qualquer
          plano alimentar e clique em{" "}
          <span className="font-medium text-text-primary">
            Salvar como modelo
          </span>
          .
        </p>

        <div className="mt-6">
          {templates.length === 0 ? (
            /* Empty state */
            <div className="rounded-lg border border-dashed border-border-subtle bg-bg-surface py-12 text-center [box-shadow:var(--shadow-xs)]">
              <LayoutTemplate
                className="mx-auto h-10 w-10 text-text-muted"
                strokeWidth={1.25}
              />
              <p className="mt-3 text-body font-medium text-text-secondary">
                Nenhum modelo salvo ainda
              </p>
              <p className="mt-1 text-caption text-text-muted">
                Abra um plano alimentar e clique em{" "}
                <strong className="font-medium">Salvar como modelo</strong> para
                criar o primeiro.
              </p>
            </div>
          ) : (
            <TemplatesClient templates={templates} />
          )}
        </div>
      </div>
    </main>
  );
}
