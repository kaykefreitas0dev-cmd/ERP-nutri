import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { RecipeEditor } from "./RecipeEditor";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const recipe = await withTenantAction(async ({ tx }) => {
      return tx.recipe.findFirst({
        where: { id, isActive: true },
        select: { name: true },
      });
    });
    return { title: recipe ? `${recipe.name} — Receitas` : "Receita" };
  } catch {
    return { title: "Receita" };
  }
}

export default async function ReceitaDetailPage({ params }: Props) {
  const { id } = await params;

  type IngRow = {
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
  };

  type RecipeData = {
    id: string;
    name: string;
    description: string | null;
    servings: number;
    prepTimeMinutes: number | null;
    notes: string | null;
    totalKcal: { toString: () => string } | null;
    totalProteinG: { toString: () => string } | null;
    totalCarbG: { toString: () => string } | null;
    totalFatG: { toString: () => string } | null;
    ingredients: IngRow[];
  };

  let recipe: RecipeData | null = null;

  try {
    recipe = await withTenantAction(async ({ tx, organizationId }) => {
      return tx.recipe.findFirst({
        where: { id, organizationId, isActive: true },
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
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!recipe) notFound();

  // Serialise Decimal fields
  const serialised = {
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
    ingredients: (recipe.ingredients as IngRow[]).map((ing) => ({
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
  };

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/app/receitas"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Receitas
        </Link>

        <div className="mt-3">
          <RecipeEditor recipe={serialised} />
        </div>
      </div>
    </main>
  );
}
