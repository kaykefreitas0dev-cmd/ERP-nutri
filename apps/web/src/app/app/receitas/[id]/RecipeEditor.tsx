"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Check,
  X,
  ChefHat,
  Clock,
  Flame,
  BookOpen,
} from "lucide-react";
import {
  searchFoodsForRecipeAction,
  addIngredientAction,
  removeIngredientAction,
  updateIngredientQtyAction,
  updateRecipeMetaAction,
  archiveRecipeAction,
} from "../actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Ingredient {
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
}

interface Recipe {
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
  ingredients: Ingredient[];
}

interface FoodResult {
  id: string;
  name: string;
  source: string;
  version: number;
  kcalPer100g: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcIngKcal(ing: Ingredient): number | null {
  if (!ing.kcalPer100g) return null;
  return Math.round(
    (parseFloat(ing.kcalPer100g) * parseFloat(ing.quantityG)) / 100,
  );
}

function sourceColor(source: string) {
  if (source === "TACO") return "bg-brand-primary-bg text-brand-primary";
  if (source === "POF") return "bg-info-bg text-info";
  return "bg-bg-muted text-text-secondary";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeEditor({ recipe: initial }: { recipe: Recipe }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Local recipe state (for optimistic updates) ─────────────────────────
  const [recipe, setRecipe] = useState<Recipe>(initial);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState("");
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // ── Name/meta inline editing ─────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initial.name);
  const [localName, setLocalName] = useState(initial.name);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Food picker ──────────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addQtyG, setAddQtyG] = useState("100");
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [pickerMsg, setPickerMsg] = useState<string | null>(null);
  const pickerMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foodSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleFoodQueryChange(q: string) {
    setFoodQuery(q);
    if (foodSearchTimer.current) clearTimeout(foodSearchTimer.current);
    if (q.trim().length < 2) {
      setFoodResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    foodSearchTimer.current = setTimeout(() => {
      searchFoodsForRecipeAction({ query: q, limit: 20 }).then((res) => {
        setSearching(false);
        if (res.ok && res.foods) setFoodResults(res.foods);
      });
    }, 280);
  }

  function showPickerMsg(msg: string) {
    if (pickerMsgTimer.current) clearTimeout(pickerMsgTimer.current);
    setPickerMsg(msg);
    pickerMsgTimer.current = setTimeout(() => setPickerMsg(null), 4_000);
  }

  async function handleAddIngredient() {
    if (!selectedFood) {
      showPickerMsg("Selecione um alimento da lista");
      return;
    }
    const qty = parseFloat(addQtyG);
    if (!qty || qty <= 0 || qty > 10_000) {
      showPickerMsg("Quantidade inválida (1–10000g)");
      return;
    }

    setAdding(true);
    const result = await addIngredientAction({
      recipeId: recipe.id,
      foodId: selectedFood.id,
      foodVersion: selectedFood.version,
      quantityG: qty,
    });
    setAdding(false);

    if (result.ok) {
      // Refresh server data
      startTransition(() => router.refresh());
      // Optimistic: add placeholder ingredient
      const optimistic: Ingredient = {
        id: result.ingredientId ?? `tmp-${Date.now()}`,
        foodId: selectedFood.id,
        foodVersion: selectedFood.version,
        foodName: selectedFood.name,
        foodSource: selectedFood.source,
        quantityG: String(qty),
        notes: null,
        sortOrder: recipe.ingredients.length,
        kcalPer100g: selectedFood.kcalPer100g,
        proteinG: null,
        carbG: null,
        fatG: null,
      };
      setRecipe((prev) => ({
        ...prev,
        ingredients: [...prev.ingredients, optimistic],
      }));
      // Reset picker
      setSelectedFood(null);
      setFoodQuery("");
      setFoodResults([]);
      setAddQtyG("100");
      setPickerOpen(false);
    } else {
      showPickerMsg(result.message ?? "Erro ao adicionar ingrediente");
    }
  }

  async function handleRemove(ingredientId: string) {
    setRemovingIds((prev) => new Set(prev).add(ingredientId));
    const result = await removeIngredientAction({
      ingredientId,
      recipeId: recipe.id,
    });
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.delete(ingredientId);
      return next;
    });

    if (result.ok) {
      setRecipe((prev) => ({
        ...prev,
        ingredients: prev.ingredients.filter((i) => i.id !== ingredientId),
      }));
      startTransition(() => router.refresh());
    }
  }

  function startQtyEdit(ing: Ingredient) {
    setEditingQtyId(ing.id);
    setQtyDraft(ing.quantityG);
    setTimeout(() => qtyInputRef.current?.select(), 20);
  }

  async function commitQtyEdit(ing: Ingredient) {
    const next = parseFloat(qtyDraft);
    setEditingQtyId(null);
    if (
      !next ||
      next <= 0 ||
      next > 10_000 ||
      next === parseFloat(ing.quantityG)
    )
      return;

    // Optimistic update
    setRecipe((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.id === ing.id ? { ...i, quantityG: String(next) } : i,
      ),
    }));

    const result = await updateIngredientQtyAction({
      ingredientId: ing.id,
      recipeId: recipe.id,
      quantityG: next,
    });
    if (!result.ok) {
      // Revert
      setRecipe((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((i) =>
          i.id === ing.id ? { ...i, quantityG: ing.quantityG } : i,
        ),
      }));
    } else {
      startTransition(() => router.refresh());
    }
  }

  function startNameEdit() {
    setNameDraft(localName);
    setEditingName(true);
    setTimeout(() => nameRef.current?.select(), 20);
  }

  async function commitNameEdit() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === localName || next.length < 2 || next.length > 120)
      return;
    setLocalName(next);
    const result = await updateRecipeMetaAction({
      recipeId: recipe.id,
      name: next,
    });
    if (!result.ok) {
      setLocalName(localName);
    } else {
      setRecipe((prev) => ({ ...prev, name: next }));
      startTransition(() => router.refresh());
    }
  }

  // ── Archive ──────────────────────────────────────────────────────────────
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    if (
      !confirm(
        `Arquivar "${recipe.name}"? A receita não aparecerá mais na lista e nos planos alimentares.`,
      )
    )
      return;
    setArchiving(true);
    const result = await archiveRecipeAction({ recipeId: recipe.id });
    if (result.ok) {
      router.push("/app/receitas");
    } else {
      setArchiving(false);
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  // Recompute optimistically from local ingredients when server value may be stale
  const localKcal = recipe.ingredients.reduce<number | null>((acc, ing) => {
    const k = calcIngKcal(ing);
    if (k === null) return acc;
    return (acc ?? 0) + k;
  }, null);

  const displayKcal =
    localKcal !== null
      ? localKcal
      : recipe.totalKcal
        ? Math.round(parseFloat(recipe.totalKcal))
        : null;

  const serverProtein = recipe.totalProteinG
    ? Math.round(parseFloat(recipe.totalProteinG))
    : null;
  const serverCarb = recipe.totalCarbG
    ? Math.round(parseFloat(recipe.totalCarbG))
    : null;
  const serverFat = recipe.totalFatG
    ? Math.round(parseFloat(recipe.totalFatG))
    : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          {/* Name */}
          <div className="group/name flex items-center gap-1">
            {editingName ? (
              <input
                ref={nameRef}
                type="text"
                maxLength={120}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitNameEdit();
                  }
                  if (e.key === "Escape") {
                    setNameDraft(localName);
                    setEditingName(false);
                  }
                }}
                className="rounded border border-brand-primary bg-bg-surface px-2 py-0.5 text-h1 font-semibold tracking-tight text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                aria-label="Nome da receita"
              />
            ) : (
              <button
                type="button"
                onClick={startNameEdit}
                title="Clique para renomear"
                className="flex items-center gap-1.5 rounded px-0.5 text-h1 font-semibold tracking-tight text-text-primary transition-colors hover:bg-bg-subtle"
              >
                {localName}
                <Pencil
                  className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover/name:opacity-100"
                  strokeWidth={1.75}
                />
              </button>
            )}
          </div>

          {/* Meta chips */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-tiny text-text-muted">
            {recipe.description && (
              <span className="text-text-secondary">{recipe.description}</span>
            )}
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" strokeWidth={1.75} />
              {recipe.servings} porção{recipe.servings !== 1 ? "ões" : ""}
            </span>
            {recipe.prepTimeMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" strokeWidth={1.75} />
                {recipe.prepTimeMinutes} min
              </span>
            )}
            {displayKcal !== null && (
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-warning" strokeWidth={1.75} />
                {displayKcal} kcal total
              </span>
            )}
          </div>
        </div>

        {/* Macro summary card */}
        {(serverProtein !== null ||
          serverCarb !== null ||
          serverFat !== null) && (
          <div className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)]">
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Macros totais
            </p>
            <div className="mt-2 flex gap-4 tabular-nums text-tiny">
              {serverProtein !== null && (
                <MacroCell
                  label="PTN"
                  color="var(--color-macro-protein)"
                  value={`${serverProtein}g`}
                />
              )}
              {serverCarb !== null && (
                <MacroCell
                  label="CHO"
                  color="var(--color-macro-carb)"
                  value={`${serverCarb}g`}
                />
              )}
              {serverFat !== null && (
                <MacroCell
                  label="LIP"
                  color="var(--color-macro-fat)"
                  value={`${serverFat}g`}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Ingredients table ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
            <h2 className="text-body font-semibold text-text-primary">
              Ingredientes
            </h2>
            <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny tabular-nums text-text-muted">
              {recipe.ingredients.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white transition-colors hover:bg-brand-primary-hover"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Adicionar
          </button>
        </div>

        {/* Food picker */}
        {pickerOpen && (
          <div className="border-b border-border-subtle bg-bg-subtle px-4 py-3">
            <p className="mb-2 text-tiny font-medium text-text-muted uppercase tracking-wider">
              Buscar alimento
            </p>

            {/* Search + selected food */}
            {!selectedFood ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={foodQuery}
                  onChange={(e) => handleFoodQueryChange(e.target.value)}
                  placeholder="Nome do alimento (mín. 2 letras)..."
                  autoFocus
                  className="w-full rounded-md border border-border-default bg-bg-surface py-2 pl-8 pr-3 text-caption focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-muted" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-brand-primary bg-bg-surface px-3 py-2">
                <span className="flex-1 text-caption font-medium text-text-primary">
                  {selectedFood.name}
                </span>
                {selectedFood.kcalPer100g && (
                  <span className="text-tiny tabular-nums text-text-muted">
                    {Math.round(parseFloat(selectedFood.kcalPer100g))} kcal/100g
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedFood(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            )}

            {/* Results list */}
            {!selectedFood && foodResults.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border-subtle bg-bg-surface divide-y divide-border-subtle [box-shadow:var(--shadow-xs)]">
                {foodResults.map((food) => (
                  <li key={food.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFood(food);
                        setFoodQuery(food.name);
                        setFoodResults([]);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption hover:bg-bg-subtle"
                    >
                      <span className="flex-1 text-text-primary">
                        {food.name}
                      </span>
                      {food.kcalPer100g && (
                        <span className="shrink-0 tabular-nums text-text-muted text-tiny">
                          {Math.round(parseFloat(food.kcalPer100g))} kcal/100g
                        </span>
                      )}
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${sourceColor(food.source)}`}
                      >
                        {food.source}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Quantity + add */}
            {selectedFood && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={addQtyG}
                  onChange={(e) => setAddQtyG(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                  className="w-24 rounded-md border border-border-default bg-bg-surface px-2 py-1.5 text-caption tabular-nums focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  aria-label="Quantidade em gramas"
                />
                <span className="text-tiny text-text-muted">g</span>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  disabled={adding}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
                >
                  {adding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  )}
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    setSelectedFood(null);
                    setFoodQuery("");
                    setFoodResults([]);
                  }}
                  className="rounded-md px-2 py-1.5 text-tiny text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            )}

            {pickerMsg && (
              <p className="mt-1.5 text-tiny text-danger">{pickerMsg}</p>
            )}
          </div>
        )}

        {/* Ingredients list */}
        {recipe.ingredients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <ChefHat className="h-8 w-8 text-text-muted" strokeWidth={1.5} />
            <p className="text-caption text-text-secondary">
              Nenhum ingrediente ainda.
            </p>
            <p className="text-tiny text-text-muted">
              Clique em <strong>Adicionar</strong> para incluir o primeiro.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-bg-subtle">
              <tr>
                <th className="px-4 py-2.5 text-left text-tiny font-medium uppercase tracking-wider text-text-muted">
                  Alimento
                </th>
                <th className="px-4 py-2.5 text-right text-tiny font-medium uppercase tracking-wider text-text-muted">
                  Qtd (g)
                </th>
                <th className="hidden sm:table-cell px-4 py-2.5 text-right text-tiny font-medium uppercase tracking-wider text-text-muted">
                  kcal
                </th>
                <th className="hidden md:table-cell px-4 py-2.5 text-right text-tiny font-medium uppercase tracking-wider text-text-muted">
                  PTN
                </th>
                <th className="hidden md:table-cell px-4 py-2.5 text-right text-tiny font-medium uppercase tracking-wider text-text-muted">
                  CHO
                </th>
                <th className="hidden md:table-cell px-4 py-2.5 text-right text-tiny font-medium uppercase tracking-wider text-text-muted">
                  LIP
                </th>
                <th className="px-4 py-2.5 text-center text-tiny font-medium uppercase tracking-wider text-text-muted">
                  Fonte
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {recipe.ingredients.map((ing) => {
                const removing = removingIds.has(ing.id);
                const editingQty = editingQtyId === ing.id;
                const qty = parseFloat(ing.quantityG);
                const ingKcal = ing.kcalPer100g
                  ? Math.round((parseFloat(ing.kcalPer100g) * qty) / 100)
                  : null;
                const ingProtein = ing.proteinG
                  ? Math.round((parseFloat(ing.proteinG) * qty) / 100)
                  : null;
                const ingCarb = ing.carbG
                  ? Math.round((parseFloat(ing.carbG) * qty) / 100)
                  : null;
                const ingFat = ing.fatG
                  ? Math.round((parseFloat(ing.fatG) * qty) / 100)
                  : null;

                return (
                  <tr
                    key={ing.id}
                    className={
                      "group/row transition-colors hover:bg-bg-subtle " +
                      (removing ? "opacity-40" : "")
                    }
                  >
                    <td className="px-4 py-2.5 text-body text-text-primary">
                      {ing.foodName}
                    </td>

                    {/* Qty (editable inline) */}
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {editingQty ? (
                        <input
                          ref={qtyInputRef}
                          type="number"
                          min={1}
                          max={10000}
                          value={qtyDraft}
                          onChange={(e) => setQtyDraft(e.target.value)}
                          onBlur={() => commitQtyEdit(ing)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitQtyEdit(ing);
                            }
                            if (e.key === "Escape") {
                              setEditingQtyId(null);
                            }
                          }}
                          className="w-20 rounded border border-brand-primary bg-bg-surface px-1.5 py-0.5 text-caption text-right focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          aria-label={`Quantidade de ${ing.foodName}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startQtyEdit(ing)}
                          title="Clique para editar quantidade"
                          className="group/qty rounded px-1 text-body tabular-nums transition-colors hover:bg-bg-subtle"
                        >
                          {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1)}
                          <span className="ml-1 text-tiny text-text-muted opacity-0 group-hover/qty:opacity-100">
                            g ✎
                          </span>
                        </button>
                      )}
                    </td>

                    {/* kcal */}
                    <td className="hidden sm:table-cell px-4 py-2.5 text-right text-caption tabular-nums text-text-secondary">
                      {ingKcal !== null ? ingKcal : "—"}
                    </td>

                    {/* PTN / CHO / LIP (hidden on small screens) */}
                    <td className="hidden md:table-cell px-4 py-2.5 text-right text-tiny tabular-nums text-text-muted">
                      {ingProtein !== null ? `${ingProtein}g` : "—"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right text-tiny tabular-nums text-text-muted">
                      {ingCarb !== null ? `${ingCarb}g` : "—"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right text-tiny tabular-nums text-text-muted">
                      {ingFat !== null ? `${ingFat}g` : "—"}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceColor(ing.foodSource)}`}
                      >
                        {ing.foodSource}
                      </span>
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemove(ing.id)}
                        disabled={removing}
                        title={`Remover ${ing.foodName}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-text-muted opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-danger-bg hover:text-danger"
                      >
                        {removing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            {displayKcal !== null && (
              <tfoot className="border-t border-border-default bg-bg-subtle">
                <tr>
                  <td className="px-4 py-2 text-caption font-semibold text-text-primary">
                    Total
                  </td>
                  <td />
                  <td className="hidden sm:table-cell px-4 py-2 text-right text-caption font-semibold tabular-nums text-text-primary">
                    {displayKcal} kcal
                  </td>
                  <td className="hidden md:table-cell px-4 py-2 text-right text-tiny tabular-nums text-text-secondary">
                    {serverProtein !== null ? `${serverProtein}g` : ""}
                  </td>
                  <td className="hidden md:table-cell px-4 py-2 text-right text-tiny tabular-nums text-text-secondary">
                    {serverCarb !== null ? `${serverCarb}g` : ""}
                  </td>
                  <td className="hidden md:table-cell px-4 py-2 text-right text-tiny tabular-nums text-text-secondary">
                    {serverFat !== null ? `${serverFat}g` : ""}
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Notes */}
      {recipe.notes && (
        <div className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)]">
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Observações
          </p>
          <p className="mt-2 whitespace-pre-wrap text-caption text-text-secondary">
            {recipe.notes}
          </p>
        </div>
      )}

      {/* Danger zone */}
      <div className="flex items-center justify-end border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-caption text-text-muted transition-colors hover:border-danger hover:bg-danger-bg hover:text-danger disabled:opacity-60"
        >
          {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Arquivar receita
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MacroCell({
  label,
  color,
  value,
}: {
  label: string;
  color: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  );
}
