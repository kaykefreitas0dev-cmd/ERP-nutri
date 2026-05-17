"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, CalendarDays } from "lucide-react";
import {
  addMealItemAction,
  removeMealItemAction,
  searchFoodsAction,
} from "../actions";

interface MealItemView {
  id: string;
  quantityG: { toString: () => string };
  preparationNotes: string | null;
  kcal: { toString: () => string } | null;
  proteinG: { toString: () => string } | null;
  carbG: { toString: () => string } | null;
  fatG: { toString: () => string } | null;
  food: { id: string; name: string; source: string };
}

interface MealView {
  id: string;
  name: string;
  scheduledTime: string | null;
  items: MealItemView[];
}

interface DayView {
  id: string;
  dayLabel: string;
  meals: MealView[];
}

interface Props {
  patientId: string;
  planId: string;
  days: DayView[];
}

export function MealPlanEditor({ days }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<
    Array<{ id: string; name: string; source: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [quantityG, setQuantityG] = useState<string>("100");

  async function handleSearchFoods(q: string) {
    setFoodQuery(q);
    if (q.length < 2) {
      setFoodResults([]);
      return;
    }
    setSearching(true);
    const result = await searchFoodsAction({ query: q, limit: 10 });
    if (result.ok && result.foods) setFoodResults(result.foods);
    setSearching(false);
  }

  async function handleAdd(mealId: string, foodId: string) {
    startTransition(async () => {
      const result = await addMealItemAction({
        mealId,
        foodId,
        quantityG: Number(quantityG),
      });
      if (!result.ok) {
        alert(result.message);
        return;
      }
      setOpenMealId(null);
      setFoodQuery("");
      setFoodResults([]);
      setQuantityG("100");
      router.refresh();
    });
  }

  async function handleRemove(itemId: string) {
    if (!confirm("Remover este alimento?")) return;
    startTransition(async () => {
      await removeMealItemAction(itemId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section
          key={day.id}
          className="rounded-lg border border-border-subtle bg-white shadow-sm"
        >
          <header className="border-b border-border-subtle bg-bg-subtle px-5 py-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <CalendarDays
                className="h-4 w-4 text-text-muted"
                strokeWidth={1.75}
              />
              {day.dayLabel}
            </h2>
          </header>

          <div className="divide-y divide-border-subtle">
            {day.meals.map((meal) => {
              // Totais da refeição
              let mealKcal = 0;
              let mealP = 0;
              let mealC = 0;
              let mealF = 0;
              for (const item of meal.items) {
                if (item.kcal) mealKcal += Number(item.kcal);
                if (item.proteinG) mealP += Number(item.proteinG);
                if (item.carbG) mealC += Number(item.carbG);
                if (item.fatG) mealF += Number(item.fatG);
              }

              return (
                <div key={meal.id} className="p-4">
                  <header className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 font-medium text-text-primary">
                        <UtensilsCrossed
                          className="h-4 w-4 text-text-muted"
                          strokeWidth={1.75}
                        />
                        {meal.name}
                        {meal.scheduledTime && (
                          <span className="ml-1 text-xs text-text-muted tabular-nums">
                            {meal.scheduledTime}
                          </span>
                        )}
                      </h3>
                      {meal.items.length > 0 && (
                        <p className="text-xs tabular-nums text-text-secondary">
                          {mealKcal.toFixed(0)} kcal · PTN {mealP.toFixed(0)}g ·
                          CHO {mealC.toFixed(0)}g · LIP {mealF.toFixed(0)}g
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMealId(openMealId === meal.id ? null : meal.id)
                      }
                      className="rounded-md bg-brand-primary px-3 py-1 text-xs font-medium text-white hover:bg-brand-primary-hover"
                    >
                      {openMealId === meal.id ? "Fechar" : "+ Adicionar"}
                    </button>
                  </header>

                  {/* Lista de items */}
                  {meal.items.length === 0 ? (
                    <p className="text-xs text-text-subtle">Sem alimentos.</p>
                  ) : (
                    <ul className="space-y-1">
                      {meal.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-md bg-bg-subtle px-3 py-2 text-sm"
                        >
                          <div className="flex-1">
                            <span className="font-medium">
                              {item.food.name}
                            </span>
                            <span className="ml-2 text-xs text-text-muted">
                              {item.quantityG.toString()}g
                            </span>
                            {item.preparationNotes && (
                              <span className="ml-1 text-xs text-text-subtle">
                                ({item.preparationNotes})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-secondary tabular-nums">
                            {item.kcal && (
                              <span>{item.kcal.toString()} kcal</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemove(item.id)}
                              disabled={pending}
                              className="text-red-600 hover:underline disabled:opacity-50"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Picker de alimento */}
                  {openMealId === meal.id && (
                    <div className="mt-3 rounded-md border border-brand-200 bg-brand-primary-bg p-3">
                      <div className="flex gap-2">
                        <input
                          type="search"
                          placeholder="Buscar alimento..."
                          value={foodQuery}
                          onChange={(e) => handleSearchFoods(e.target.value)}
                          className="flex-1 rounded-md border border-border-default px-3 py-2 text-sm"
                          autoFocus
                        />
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          value={quantityG}
                          onChange={(e) => setQuantityG(e.target.value)}
                          className="w-20 rounded-md border border-border-default px-2 py-2 text-sm tabular-nums"
                          placeholder="g"
                        />
                      </div>

                      {searching && (
                        <p className="mt-2 text-xs text-text-muted">
                          Buscando…
                        </p>
                      )}

                      {foodResults.length > 0 && (
                        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                          {foodResults.map((f) => (
                            <li key={f.id}>
                              <button
                                type="button"
                                onClick={() => handleAdd(meal.id, f.id)}
                                disabled={pending}
                                className="block w-full rounded-md border border-border-default bg-white px-3 py-2 text-left text-sm hover:border-brand-primary hover:bg-brand-100 disabled:opacity-50"
                              >
                                <span className="font-medium">{f.name}</span>
                                <span className="ml-2 text-xs text-text-muted">
                                  ({f.source})
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {foodQuery.length >= 2 &&
                        foodResults.length === 0 &&
                        !searching && (
                          <p className="mt-2 text-xs text-text-muted">
                            Nenhum alimento encontrado.
                          </p>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {days.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-default p-12 text-center text-text-muted">
          Sem dias configurados.
        </div>
      )}
    </div>
  );
}
