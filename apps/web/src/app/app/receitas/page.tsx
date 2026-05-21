import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, BookOpen } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { RecipeListClient } from "./RecipeListClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receitas" };

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ReceitasPage({ searchParams }: Props) {
  const { q } = await searchParams;

  type RecipeRow = {
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
  };

  let recipes: RecipeRow[] = [];

  try {
    recipes = await withTenantAction(async ({ tx }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (q && q.trim().length >= 2) {
        where.name = { contains: q.trim(), mode: "insensitive" };
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
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  const rows = (recipes as RecipeRow[]).map((r) => ({
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
  }));

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen
                className="h-5 w-5 text-brand-primary"
                strokeWidth={1.75}
              />
              <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
                Receitas
              </h1>
            </div>
            <p className="mt-1 text-caption text-text-secondary tabular-nums">
              {rows.length} receitas da sua clínica
            </p>
          </div>

          <Link
            href="/app/receitas/new"
            className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-brand-primary-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Nova receita
          </Link>
        </header>

        {/* Search */}
        <form className="mb-6">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar receita..."
            className="w-full max-w-sm rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </form>

        {/* List */}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
            {q ? (
              <p className="text-text-secondary">
                Nenhuma receita encontrada para &ldquo;{q}&rdquo;.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <BookOpen
                  className="h-10 w-10 text-text-muted"
                  strokeWidth={1.5}
                />
                <p className="text-text-secondary">
                  Nenhuma receita cadastrada ainda.
                </p>
                <Link
                  href="/app/receitas/new"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-brand-primary-hover"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Criar primeira receita
                </Link>
              </div>
            )}
          </div>
        ) : (
          <RecipeListClient recipes={rows} />
        )}
      </div>
    </main>
  );
}
