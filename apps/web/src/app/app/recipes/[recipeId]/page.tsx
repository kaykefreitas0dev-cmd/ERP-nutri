import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, Users } from "lucide-react";
import { SectionHeader } from "@repo/ui/section-header";
import { getRecipeAction } from "../actions";
import { RecipeIngredientEditor } from "./RecipeIngredientEditor";
import { DeleteRecipeButton } from "./DeleteRecipeButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar receita" };

interface Props {
  params: Promise<{ recipeId: string }>;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { recipeId } = await params;
  const recipe = await getRecipeAction(recipeId);
  if (!recipe) notFound();

  const perServing =
    recipe.totalKcal != null && recipe.servings > 0
      ? Math.round(recipe.totalKcal / recipe.servings)
      : null;

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/app/recipes"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Receitas
        </Link>

        <SectionHeader
          as="h1"
          className="mt-3 mb-0"
          label="Receitas"
          title={recipe.name}
          description={recipe.description || undefined}
          action={
            <DeleteRecipeButton recipeId={recipe.id} name={recipe.name} />
          }
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-tiny text-text-muted tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
            {recipe.servings} porç{recipe.servings === 1 ? "ão" : "ões"}
          </span>
          {recipe.prepTimeMinutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              {recipe.prepTimeMinutes} min
            </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecipeIngredientEditor
              recipeId={recipe.id}
              ingredients={recipe.ingredients}
            />
          </div>

          {/* Resumo nutricional */}
          <aside>
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
              <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Resumo nutricional
              </h2>
              <div className="mt-3">
                <p className="text-h1 font-semibold tabular-nums text-text-primary">
                  {recipe.totalKcal != null ? recipe.totalKcal.toFixed(0) : "—"}
                  <span className="ml-1 text-caption font-normal text-text-secondary">
                    kcal total
                  </span>
                </p>
                {perServing != null && (
                  <p className="text-caption text-text-secondary tabular-nums">
                    {perServing} kcal por porção
                  </p>
                )}
              </div>
              <dl className="mt-4 space-y-2 text-body">
                <Row label="Proteína" value={recipe.totalProteinG} unit="g" />
                <Row label="Carboidrato" value={recipe.totalCarbG} unit="g" />
                <Row label="Lipídeo" value={recipe.totalFatG} unit="g" />
              </dl>
              <p className="mt-4 text-tiny text-text-muted">
                Calculado automaticamente dos ingredientes.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-tiny text-text-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-text-primary">
        {value != null ? `${value.toFixed(1)} ${unit}` : "—"}
      </dd>
    </div>
  );
}
