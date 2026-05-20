"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  UtensilsCrossed,
  CalendarDays,
  Plus,
  X,
  Search,
} from "lucide-react";
import {
  addMealItemAction,
  removeMealItemAction,
  searchFoodsAction,
  reorderMealItemsAction,
  reorderMealsAction,
} from "../actions";

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Sortable item (food within a meal) ──────────────────────────────────────
function SortableMealItem({
  item,
  pending,
  onRemove,
}: {
  item: MealItemView;
  pending: boolean;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        "group flex items-center gap-2 rounded-md border bg-bg-surface px-3 py-2 text-body transition-colors " +
        (isDragging
          ? "border-brand-200 [box-shadow:var(--shadow-md)]"
          : "border-border-subtle hover:border-border-default hover:bg-bg-surface-hover")
      }
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        className="shrink-0 cursor-grab touch-none text-text-muted opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-text-primary">{item.food.name}</span>
        <span className="ml-2 text-caption text-text-muted tabular-nums">
          {item.quantityG.toString()}g
        </span>
        {item.preparationNotes && (
          <span className="ml-1 text-caption text-text-subtle">
            ({item.preparationNotes})
          </span>
        )}
      </div>

      {/* Macros + remove */}
      <div className="flex shrink-0 items-center gap-3 text-caption text-text-secondary tabular-nums">
        {item.kcal && (
          <span className="font-medium">{item.kcal.toString()} kcal</span>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={pending}
          aria-label={`Remover ${item.food.name}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-danger-bg hover:text-danger disabled:opacity-50 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

// ── Sortable meal (a meal within a day) ──────────────────────────────────────
function SortableMeal({
  meal,
  pendingGlobal,
  openMealId,
  onToggleOpen,
  onAddItem,
  onRemoveItem,
}: {
  meal: MealView;
  pendingGlobal: boolean;
  openMealId: string | null;
  onToggleOpen: (mealId: string) => void;
  onAddItem: (mealId: string, foodId: string, quantityG: number) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: meal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [, itemTransition] = useTransition();
  const [localItems, setLocalItems] = useState(meal.items);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<
    Array<{ id: string; name: string; source: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [quantityG, setQuantityG] = useState("100");

  // Sync local items when server props change (add/remove)
  const prevItemsRef = useRef(meal.items);
  useEffect(() => {
    if (prevItemsRef.current !== meal.items) {
      prevItemsRef.current = meal.items;
      setLocalItems(meal.items);
    }
  }, [meal.items]);

  const isOpen = openMealId === meal.id;

  // Compute totals from local items
  let mealKcal = 0,
    mealP = 0,
    mealC = 0,
    mealF = 0;
  for (const item of localItems) {
    if (item.kcal) mealKcal += Number(item.kcal);
    if (item.proteinG) mealP += Number(item.proteinG);
    if (item.carbG) mealC += Number(item.carbG);
    if (item.fatG) mealF += Number(item.fatG);
  }

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(localItems, oldIndex, newIndex);

    setLocalItems(newItems); // optimistic

    itemTransition(async () => {
      await reorderMealItemsAction({
        mealId: meal.id,
        orderedIds: newItems.map((i) => i.id),
      });
    });
  }

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "group/meal border-b border-border-subtle last:border-b-0 " +
        (isDragging
          ? "rounded-md border border-brand-200 [box-shadow:var(--shadow-sm)]"
          : "")
      }
    >
      <div className="p-4">
        {/* Meal header */}
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {/* Drag handle for meal */}
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Arrastar refeição"
              className="mt-0.5 shrink-0 cursor-grab touch-none text-text-muted opacity-0 transition-opacity active:cursor-grabbing group-hover/meal:opacity-60 hover:!opacity-100"
            >
              <GripVertical className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-2 text-body font-semibold text-text-primary">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary-bg text-brand-primary">
                  <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                {meal.name}
                {meal.scheduledTime && (
                  <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny font-medium text-text-secondary tabular-nums">
                    {meal.scheduledTime}
                  </span>
                )}
              </h3>
              {localItems.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-tiny tabular-nums">
                  <span className="rounded-full bg-bg-subtle px-2 py-0.5 font-medium text-text-primary">
                    {mealKcal.toFixed(0)} kcal
                  </span>
                  <MacroPill
                    color="var(--color-macro-protein)"
                    label="PTN"
                    value={`${mealP.toFixed(0)}g`}
                  />
                  <MacroPill
                    color="var(--color-macro-carb)"
                    label="CHO"
                    value={`${mealC.toFixed(0)}g`}
                  />
                  <MacroPill
                    color="var(--color-macro-fat)"
                    label="LIP"
                    value={`${mealF.toFixed(0)}g`}
                  />
                </div>
              ) : (
                <p className="mt-1 text-tiny text-text-subtle">
                  Sem alimentos. Adicione abaixo.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleOpen(meal.id)}
            aria-expanded={isOpen}
            className={
              "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-tiny font-medium transition-all duration-fast active:scale-[0.98] " +
              (isOpen
                ? "border border-border-default bg-bg-surface text-text-primary hover:bg-bg-surface-hover"
                : "bg-brand-primary text-white [box-shadow:var(--shadow-sm)] hover:bg-brand-primary-hover")
            }
          >
            {isOpen ? (
              <>
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Fechar
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Adicionar
              </>
            )}
          </button>
        </header>

        {/* Sortable items list */}
        {localItems.length > 0 && (
          <DndContext
            sensors={itemSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={localItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1.5">
                {localItems.map((item) => (
                  <SortableMealItem
                    key={item.id}
                    item={item}
                    pending={pendingGlobal}
                    onRemove={(id) => onRemoveItem(id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Food picker */}
        {isOpen && (
          <div className="mt-3 rounded-md border border-brand-200 bg-brand-primary-bg p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder="Buscar alimento (TACO, POF, receita)..."
                  value={foodQuery}
                  onChange={(e) => handleSearchFoods(e.target.value)}
                  className="h-9 w-full rounded-sm border border-border-default bg-bg-surface pl-9 pr-3 text-body text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
                  autoFocus
                />
              </div>
              <input
                type="number"
                min="1"
                max="5000"
                value={quantityG}
                onChange={(e) => setQuantityG(e.target.value)}
                className="h-9 w-20 rounded-sm border border-border-default bg-bg-surface px-2 text-body tabular-nums focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
                placeholder="g"
              />
            </div>

            {searching && (
              <p className="mt-2 text-tiny text-text-muted">Buscando…</p>
            )}

            {foodResults.length > 0 && (
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {foodResults.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onAddItem(meal.id, f.id, Number(quantityG));
                        setFoodQuery("");
                        setFoodResults([]);
                        setQuantityG("100");
                      }}
                      disabled={pendingGlobal}
                      className="flex w-full items-center justify-between rounded-md border border-border-default bg-bg-surface px-3 py-2 text-left text-body transition-all hover:border-brand-primary hover:bg-brand-primary-bg disabled:opacity-50"
                    >
                      <span className="font-medium text-text-primary">
                        {f.name}
                      </span>
                      <span className="text-tiny font-medium uppercase tracking-wider text-text-muted">
                        {f.source}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {foodQuery.length >= 2 &&
              foodResults.length === 0 &&
              !searching && (
                <p className="mt-2 text-tiny text-text-muted">
                  Nenhum alimento encontrado para &ldquo;{foodQuery}&rdquo;.
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────────
export function MealPlanEditor({ days }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [localDays, setLocalDays] = useState<DayView[]>(days);

  // Sync from server after add/remove (key-based remount is simpler, but
  // let's use a ref comparison so we don't lose drag state unnecessarily)
  const prevDaysRef = useRef(days);
  useEffect(() => {
    if (prevDaysRef.current !== days) {
      prevDaysRef.current = days;
      setLocalDays(days);
    }
  }, [days]);

  const mealSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleMealDragEnd(dayId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const day = localDays.find((d) => d.id === dayId);
    if (!day) return;

    const oldIndex = day.meals.findIndex((m) => m.id === active.id);
    const newIndex = day.meals.findIndex((m) => m.id === over.id);
    const newMeals = arrayMove(day.meals, oldIndex, newIndex);

    setLocalDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, meals: newMeals } : d)),
    );

    startTransition(async () => {
      await reorderMealsAction({
        mealPlanDayId: dayId,
        orderedIds: newMeals.map((m) => m.id),
      });
    });
  }

  function handleAddItem(mealId: string, foodId: string, quantityG: number) {
    setOpenMealId(null);
    startTransition(async () => {
      const result = await addMealItemAction({ mealId, foodId, quantityG });
      if (!result.ok) {
        alert(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleRemoveItem(itemId: string) {
    if (!confirm("Remover este alimento?")) return;
    startTransition(async () => {
      await removeMealItemAction(itemId);
      router.refresh();
    });
  }

  if (localDays.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default p-12 text-center text-text-muted">
        Sem dias configurados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {localDays.map((day) => (
        <section
          key={day.id}
          className="rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]"
        >
          <header className="flex items-center justify-between border-b border-border-subtle bg-bg-subtle px-5 py-3">
            <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
              <CalendarDays
                className="h-4 w-4 text-text-muted"
                strokeWidth={1.75}
              />
              {day.dayLabel}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-tiny font-medium uppercase tracking-wider text-text-muted tabular-nums">
                {day.meals.length}{" "}
                {day.meals.length === 1 ? "refeição" : "refeições"}
              </span>
              {day.meals.length > 1 && (
                <span className="text-tiny text-text-muted">
                  · arraste para reordenar
                </span>
              )}
            </div>
          </header>

          {/* Sortable meals within this day */}
          <DndContext
            sensors={mealSensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleMealDragEnd(day.id, event)}
          >
            <SortableContext
              items={day.meals.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-border-subtle">
                {day.meals.map((meal) => (
                  <SortableMeal
                    key={meal.id}
                    meal={meal}
                    pendingGlobal={pending}
                    openMealId={openMealId}
                    onToggleOpen={(id) =>
                      setOpenMealId((prev) => (prev === id ? null : id))
                    }
                    onAddItem={handleAddItem}
                    onRemoveItem={handleRemoveItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      ))}
    </div>
  );
}

// ── MacroPill ────────────────────────────────────────────────────────────────
function MacroPill({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2 py-0.5">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </span>
  );
}
