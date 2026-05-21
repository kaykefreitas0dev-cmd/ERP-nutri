"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock,
  Flame,
  Layers,
  Archive,
  Loader2,
} from "lucide-react";
import { archiveRecipeAction } from "./actions";

interface RecipeRow {
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
}

interface Props {
  recipes: RecipeRow[];
}

export function RecipeListClient({ recipes: initialRecipes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [archiving, setArchiving] = useState<Set<string>>(new Set());

  async function handleArchive(
    e: React.MouseEvent,
    recipeId: string,
    recipeName: string,
  ) {
    e.preventDefault();
    if (
      !confirm(
        `Arquivar "${recipeName}"? A receita não aparecerá mais na lista.`,
      )
    )
      return;

    setArchiving((prev) => new Set(prev).add(recipeId));
    const result = await archiveRecipeAction({ recipeId });
    setArchiving((prev) => {
      const next = new Set(prev);
      next.delete(recipeId);
      return next;
    });

    if (result.ok) {
      // Optimistic remove
      setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => {
        const kcal = recipe.totalKcal
          ? Math.round(parseFloat(recipe.totalKcal))
          : null;
        const isArchiving = archiving.has(recipe.id);

        return (
          <div
            key={recipe.id}
            className={
              "group relative flex flex-col rounded-lg border border-border-subtle bg-bg-surface p-4 transition-all [box-shadow:var(--shadow-xs)] hover:border-border-default hover:[box-shadow:var(--shadow-sm)] " +
              (isArchiving ? "opacity-50 pointer-events-none" : "")
            }
          >
            {/* Archive button */}
            <button
              type="button"
              onClick={(e) => handleArchive(e, recipe.id, recipe.name)}
              disabled={isArchiving}
              title="Arquivar receita"
              className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg-subtle hover:text-text-secondary"
            >
              {isArchiving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </button>

            {/* Name + description */}
            <Link href={`/app/receitas/${recipe.id}`} className="flex-1">
              <p className="pr-6 text-body font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-brand-primary transition-colors">
                {recipe.name}
              </p>
              {recipe.description && (
                <p className="mt-1 text-tiny text-text-muted line-clamp-2">
                  {recipe.description}
                </p>
              )}
            </Link>

            {/* Stats row */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-tiny tabular-nums text-text-muted">
              {kcal !== null && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-warning" strokeWidth={1.75} />
                  {kcal} kcal
                </span>
              )}
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" strokeWidth={1.75} />
                {recipe.ingredientCount} ing.
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[10px]">×</span>
                {recipe.servings} porção{recipe.servings !== 1 ? "ões" : ""}
              </span>
              {recipe.prepTimeMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" strokeWidth={1.75} />
                  {recipe.prepTimeMinutes}min
                </span>
              )}
            </div>

            {/* Macro chips */}
            {(recipe.totalProteinG ||
              recipe.totalCarbG ||
              recipe.totalFatG) && (
              <div className="mt-2 flex gap-1.5">
                {recipe.totalProteinG && (
                  <MacroChip
                    color="var(--color-macro-protein)"
                    label="PTN"
                    value={`${Math.round(parseFloat(recipe.totalProteinG))}g`}
                  />
                )}
                {recipe.totalCarbG && (
                  <MacroChip
                    color="var(--color-macro-carb)"
                    label="CHO"
                    value={`${Math.round(parseFloat(recipe.totalCarbG))}g`}
                  />
                )}
                {recipe.totalFatG && (
                  <MacroChip
                    color="var(--color-macro-fat)"
                    label="LIP"
                    value={`${Math.round(parseFloat(recipe.totalFatG))}g`}
                  />
                )}
              </div>
            )}

            {/* CTA arrow */}
            <Link
              href={`/app/receitas/${recipe.id}`}
              className="mt-3 flex items-center gap-1 text-tiny font-medium text-brand-primary"
            >
              Ver ingredientes
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function MacroChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] tabular-nums">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-secondary">{value}</span>
    </div>
  );
}
