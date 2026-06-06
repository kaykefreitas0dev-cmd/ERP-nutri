"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Loader2 } from "lucide-react";
import { searchFoodsAction } from "../../patients/[id]/meal-plans/actions";
import {
  addRecipeIngredientAction,
  removeRecipeIngredientAction,
  type RecipeIngredientView,
} from "../actions";

export function RecipeIngredientEditor({
  recipeId,
  ingredients,
}: {
  recipeId: string;
  ingredients: RecipeIngredientView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ id: string; name: string; source: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [qty, setQty] = useState("100");

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const r = await searchFoodsAction({ query: q, limit: 10 });
    if (r.ok && r.foods) setResults(r.foods);
    setSearching(false);
  }

  function handleAdd(foodId: string) {
    setError(null);
    startTransition(async () => {
      const r = await addRecipeIngredientAction({
        recipeId,
        foodId,
        quantityG: Number(qty) || 0,
      });
      if (r.ok) {
        setQuery("");
        setResults([]);
        setQty("100");
        router.refresh();
      } else {
        setError(r.message ?? "Erro ao adicionar ingrediente");
      }
    });
  }

  function handleRemove(ingredientId: string) {
    startTransition(async () => {
      const r = await removeRecipeIngredientAction({ ingredientId, recipeId });
      if (r.ok) router.refresh();
      else setError(r.message ?? "Erro ao remover");
    });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <h2 className="text-h3 font-semibold text-text-primary">Ingredientes</h2>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-danger-bg p-3 text-body text-danger"
        >
          {error}
        </div>
      )}

      {ingredients.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {ingredients.map((it) => (
            <li
              key={it.id}
              className="group flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-body"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-text-primary">
                  {it.foodName}
                </span>
                <span className="ml-2 text-caption text-text-muted tabular-nums">
                  {it.quantityG}g
                </span>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-tiny text-text-muted tabular-nums">
                  {it.kcal != null && <span>{it.kcal.toFixed(0)} kcal</span>}
                  {it.proteinG != null && (
                    <span>· P {it.proteinG.toFixed(1)}g</span>
                  )}
                  {it.carbG != null && <span>· C {it.carbG.toFixed(1)}g</span>}
                  {it.fatG != null && <span>· L {it.fatG.toFixed(1)}g</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(it.id)}
                disabled={pending}
                aria-label={`Remover ${it.foodName}`}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-danger-bg hover:text-danger disabled:opacity-50 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-caption text-text-muted">
          Nenhum ingrediente ainda. Busque um alimento abaixo.
        </p>
      )}

      {/* Food picker */}
      <div className="mt-4 rounded-md border border-brand-200 bg-brand-primary-bg p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              placeholder="Buscar alimento (TACO, POF)…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-sm border border-border-default bg-bg-surface pl-9 pr-3 text-body text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
            />
          </div>
          <input
            type="number"
            min="1"
            max="50000"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-9 w-20 rounded-sm border border-border-default bg-bg-surface px-2 text-body tabular-nums focus:border-brand-primary focus:outline-none"
            placeholder="g"
          />
        </div>

        {searching && (
          <p className="mt-2 text-tiny text-text-muted">Buscando…</p>
        )}

        {results.length > 0 && (
          <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {results.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(f.id)}
                  disabled={pending}
                  className="flex w-full items-center justify-between rounded-md border border-border-default bg-bg-surface px-3 py-2 text-left text-body transition-all hover:border-brand-primary hover:bg-brand-primary-bg disabled:opacity-50"
                >
                  <span className="font-medium text-text-primary">
                    {f.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-tiny font-medium uppercase tracking-wider text-text-muted">
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" strokeWidth={2} />
                    )}
                    {f.source}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
