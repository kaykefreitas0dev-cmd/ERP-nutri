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
  TriangleAlert,
  Pencil,
  Trash2,
  Clock,
} from "lucide-react";
import {
  addMealItemAction,
  removeMealItemAction,
  updateMealItemQuantityAction,
  updateMealItemNotesAction,
  updateMealPlanDayLabelAction,
  updateMealNameAction,
  updateMealScheduledTimeAction,
  addMealToDayAction,
  deleteMealAction,
  addDayToMealPlanAction,
  deleteMealPlanDayAction,
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
  onUpdateQuantity,
  onUpdateNotes,
}: {
  item: MealItemView;
  pending: boolean;
  onRemove: (id: string) => void;
  onUpdateQuantity: (itemId: string, quantityG: number) => void;
  onUpdateNotes: (itemId: string, notes: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  // Inline quantity editing
  const [editingQty, setEditingQty] = useState(false);
  const [qtyValue, setQtyValue] = useState(item.quantityG.toString());
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(item.preparationNotes ?? "");
  const notesInputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setQtyValue(item.quantityG.toString());
    setEditingQty(true);
    // focus after render
    setTimeout(() => qtyInputRef.current?.select(), 20);
  }

  function commitEdit() {
    const n = parseFloat(qtyValue);
    setEditingQty(false);
    if (
      !isNaN(n) &&
      n > 0 &&
      n <= 5000 &&
      n !== parseFloat(item.quantityG.toString())
    ) {
      onUpdateQuantity(item.id, n);
    }
  }

  function cancelEdit() {
    setQtyValue(item.quantityG.toString());
    setEditingQty(false);
  }

  function startNotesEdit() {
    if (editingQty) return; // don't allow both at once
    setNotesValue(item.preparationNotes ?? "");
    setEditingNotes(true);
    setTimeout(() => {
      notesInputRef.current?.focus();
      notesInputRef.current?.select();
    }, 20);
  }

  function commitNotesEdit() {
    const next = notesValue.trim();
    setEditingNotes(false);
    if (next !== (item.preparationNotes ?? "")) {
      onUpdateNotes(item.id, next);
    }
  }

  function cancelNotesEdit() {
    setNotesValue(item.preparationNotes ?? "");
    setEditingNotes(false);
  }

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
        {editingQty ? (
          <input
            ref={qtyInputRef}
            type="number"
            min={1}
            max={5000}
            step={1}
            value={qtyValue}
            onChange={(e) => setQtyValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            className="ml-1.5 w-16 rounded border border-brand-primary bg-bg-surface px-1.5 py-0.5 text-caption tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            aria-label="Quantidade em gramas"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            disabled={pending}
            title="Clique para editar a quantidade"
            className="ml-2 rounded px-0.5 text-caption text-text-muted tabular-nums transition-colors hover:bg-bg-subtle hover:text-text-primary disabled:pointer-events-none"
          >
            {item.quantityG.toString()}g
          </button>
        )}
        {!editingQty &&
          (editingNotes ? (
            <input
              ref={notesInputRef}
              type="text"
              maxLength={500}
              placeholder="Modo de preparo…"
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={commitNotesEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitNotesEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelNotesEdit();
                }
              }}
              className="ml-1.5 w-36 rounded border border-brand-primary bg-bg-surface px-1.5 py-0.5 text-caption text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              aria-label="Notas de preparo"
            />
          ) : item.preparationNotes ? (
            <button
              type="button"
              onClick={startNotesEdit}
              disabled={pending}
              title="Clique para editar as notas de preparo"
              className="ml-1 rounded px-0.5 text-caption text-text-subtle transition-colors hover:bg-bg-subtle hover:text-text-secondary disabled:pointer-events-none"
            >
              ({item.preparationNotes})
            </button>
          ) : (
            <button
              type="button"
              onClick={startNotesEdit}
              disabled={pending}
              title="Adicionar nota de preparo"
              aria-label="Adicionar nota de preparo"
              className="ml-1 rounded px-0.5 text-caption text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg-subtle hover:text-text-secondary disabled:pointer-events-none"
            >
              + nota
            </button>
          ))}
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
  canDelete,
  onToggleOpen,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateNotes,
  onUpdateName,
  onUpdateScheduledTime,
  onDelete,
}: {
  meal: MealView;
  pendingGlobal: boolean;
  openMealId: string | null;
  canDelete: boolean;
  onToggleOpen: (mealId: string) => void;
  onAddItem: (mealId: string, foodId: string, quantityG: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantityG: number) => void;
  onUpdateNotes: (itemId: string, notes: string) => void;
  onUpdateName: (mealId: string, name: string) => void;
  onUpdateScheduledTime: (mealId: string, scheduledTime: string | null) => void;
  onDelete: (mealId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: meal.id });

  // Inline meal name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(meal.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startNameEdit() {
    setNameValue(meal.name);
    setEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 20);
  }

  function commitNameEdit() {
    const next = nameValue.trim();
    setEditingName(false);
    if (next && next !== meal.name) {
      onUpdateName(meal.id, next);
    }
  }

  function cancelNameEdit() {
    setNameValue(meal.name);
    setEditingName(false);
  }

  // Inline delete confirm
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Inline scheduled time editing
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState(meal.scheduledTime ?? "");
  const timeInputRef = useRef<HTMLInputElement>(null);

  function startTimeEdit() {
    setTimeValue(meal.scheduledTime ?? "");
    setEditingTime(true);
    setTimeout(() => timeInputRef.current?.focus(), 20);
  }

  function commitTimeEdit() {
    const next = timeValue.trim() || null;
    setEditingTime(false);
    if (next !== meal.scheduledTime) {
      onUpdateScheduledTime(meal.id, next);
    }
  }

  function cancelTimeEdit() {
    setTimeValue(meal.scheduledTime ?? "");
    setEditingTime(false);
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [, itemTransition] = useTransition();
  const [localItems, setLocalItems] = useState(meal.items);
  const [foodQuery, setFoodQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [foodResults, setFoodResults] = useState<
    Array<{
      id: string;
      name: string;
      source: string;
      kcalPer100g: { toString: () => string } | null;
    }>
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

  function handleSearchFoods(q: string) {
    setFoodQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) {
      setFoodResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const result = await searchFoodsAction({ query: q, limit: 10 });
      if (result.ok && result.foods) setFoodResults(result.foods);
      setSearching(false);
    }, 300);
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
              <h3 className="group/mealname flex flex-wrap items-center gap-2 text-body font-semibold text-text-primary">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary-bg text-brand-primary">
                  <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    maxLength={80}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitNameEdit();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelNameEdit();
                      }
                    }}
                    className="rounded border border-brand-primary bg-bg-surface px-2 py-0.5 text-body font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    aria-label="Nome da refeição"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startNameEdit}
                    disabled={pendingGlobal}
                    title="Clique para renomear a refeição"
                    className="flex items-center gap-1 rounded px-0.5 transition-colors hover:bg-bg-subtle disabled:pointer-events-none"
                  >
                    {meal.name}
                    <Pencil
                      className="h-3 w-3 text-text-muted opacity-0 transition-opacity group-hover/mealname:opacity-100"
                      strokeWidth={1.75}
                    />
                  </button>
                )}
                {editingTime ? (
                  <input
                    ref={timeInputRef}
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    onBlur={commitTimeEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitTimeEdit();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelTimeEdit();
                      }
                    }}
                    className="h-6 w-28 rounded border border-brand-primary bg-bg-surface px-1.5 text-tiny tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    aria-label="Horário da refeição"
                  />
                ) : meal.scheduledTime ? (
                  <button
                    type="button"
                    onClick={startTimeEdit}
                    disabled={pendingGlobal}
                    title="Clique para editar o horário"
                    className="inline-flex items-center gap-0.5 rounded-full bg-bg-subtle px-2 py-0.5 text-tiny font-medium text-text-secondary tabular-nums transition-colors hover:bg-bg-surface-hover hover:text-text-primary disabled:pointer-events-none"
                  >
                    {meal.scheduledTime}
                    <Pencil
                      className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/mealname:opacity-70"
                      strokeWidth={1.75}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startTimeEdit}
                    disabled={pendingGlobal}
                    title="Definir horário"
                    aria-label="Definir horário da refeição"
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-tiny text-text-muted opacity-0 transition-all hover:bg-bg-subtle hover:text-text-secondary disabled:pointer-events-none group-hover/mealname:opacity-100"
                  >
                    <Clock className="h-3 w-3" strokeWidth={1.75} />
                  </button>
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

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleOpen(meal.id)}
              aria-expanded={isOpen}
              className={
                "inline-flex h-8 items-center gap-1 rounded-md px-3 text-tiny font-medium transition-all duration-fast active:scale-[0.98] " +
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

            {canDelete && !confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={pendingGlobal}
                aria-label={`Excluir ${meal.name}`}
                title="Excluir refeição"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-danger-bg hover:text-danger disabled:opacity-50 group-hover/meal:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}

            {confirmingDelete && (
              <div className="flex items-center gap-1.5">
                <span className="text-tiny text-text-secondary">Excluir?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete(meal.id);
                  }}
                  disabled={pendingGlobal}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-tiny font-medium bg-danger text-white hover:opacity-90 disabled:opacity-50"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-tiny text-text-secondary hover:text-text-primary"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
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
                    onUpdateQuantity={(id, qty) => onUpdateQuantity(id, qty)}
                    onUpdateNotes={(id, notes) => onUpdateNotes(id, notes)}
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
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border-default bg-bg-surface px-3 py-2 text-left text-body transition-all hover:border-brand-primary hover:bg-brand-primary-bg disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                        {f.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {f.kcalPer100g != null && (
                          <span className="tabular-nums text-tiny text-text-muted">
                            {Math.round(Number(f.kcalPer100g))} kcal/100g
                          </span>
                        )}
                        <span className="text-tiny font-medium uppercase tracking-wider text-text-muted">
                          {f.source}
                        </span>
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
export function MealPlanEditor({ planId, days }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [localDays, setLocalDays] = useState<DayView[]>(days);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Day label inline editing
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [dayLabelValue, setDayLabelValue] = useState("");
  const dayLabelInputRef = useRef<HTMLInputElement>(null);

  // Add meal inline form
  const [addingMealDayId, setAddingMealDayId] = useState<string | null>(null);
  const [addMealName, setAddMealName] = useState("");
  const [addMealTime, setAddMealTime] = useState("");
  const addMealInputRef = useRef<HTMLInputElement>(null);

  // Day-level actions
  const [confirmingDeleteDayId, setConfirmingDeleteDayId] = useState<
    string | null
  >(null);

  // Auto-dismiss error banner after 6 seconds
  useEffect(() => {
    if (!errorMsg) return;
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 6_000);
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [errorMsg]);

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
        setErrorMsg(result.message ?? "Erro ao adicionar alimento");
        return;
      }
      router.refresh();
    });
  }

  function handleRemoveItem(itemId: string) {
    startTransition(async () => {
      await removeMealItemAction(itemId);
      router.refresh();
    });
  }

  function handleUpdateQuantity(itemId: string, quantityG: number) {
    startTransition(async () => {
      const result = await updateMealItemQuantityAction({ itemId, quantityG });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao atualizar quantidade");
        return;
      }
      router.refresh();
    });
  }

  function handleUpdateNotes(itemId: string, notes: string) {
    startTransition(async () => {
      const result = await updateMealItemNotesAction({ itemId, notes });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao salvar nota");
        return;
      }
      router.refresh();
    });
  }

  function startDayLabelEdit(day: DayView) {
    setDayLabelValue(day.dayLabel);
    setEditingDayId(day.id);
    setTimeout(() => {
      dayLabelInputRef.current?.select();
    }, 20);
  }

  function commitDayLabelEdit(dayId: string) {
    const originalDay = localDays.find((d) => d.id === dayId);
    const next = dayLabelValue.trim();
    setEditingDayId(null);
    if (!next || !originalDay || next === originalDay.dayLabel) return;

    // Optimistic local update
    setLocalDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, dayLabel: next } : d)),
    );

    startTransition(async () => {
      const result = await updateMealPlanDayLabelAction({
        dayId,
        dayLabel: next,
      });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao renomear o dia");
        // Revert optimistic update
        setLocalDays((prev) =>
          prev.map((d) =>
            d.id === dayId ? { ...d, dayLabel: originalDay.dayLabel } : d,
          ),
        );
      }
    });
  }

  function cancelDayLabelEdit() {
    setEditingDayId(null);
  }

  function handleUpdateMealName(mealId: string, name: string) {
    startTransition(async () => {
      const result = await updateMealNameAction({ mealId, name });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao renomear refeição");
        return;
      }
      router.refresh();
    });
  }

  function handleUpdateMealScheduledTime(
    mealId: string,
    scheduledTime: string | null,
  ) {
    startTransition(async () => {
      const result = await updateMealScheduledTimeAction({
        mealId,
        scheduledTime,
      });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao atualizar horário");
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteMeal(mealId: string) {
    startTransition(async () => {
      const result = await deleteMealAction(mealId);
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao excluir refeição");
        return;
      }
      router.refresh();
    });
  }

  function handleAddMeal(dayId: string, name: string, scheduledTime: string) {
    setAddingMealDayId(null);
    startTransition(async () => {
      const result = await addMealToDayAction({
        mealPlanDayId: dayId,
        name,
        scheduledTime: scheduledTime || undefined,
      });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao adicionar refeição");
        return;
      }
      router.refresh();
    });
  }

  function handleAddDay() {
    startTransition(async () => {
      const result = await addDayToMealPlanAction({ mealPlanId: planId });
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao adicionar dia");
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteDay(dayId: string) {
    setConfirmingDeleteDayId(null);
    startTransition(async () => {
      const result = await deleteMealPlanDayAction(dayId);
      if (!result.ok) {
        setErrorMsg(result.message ?? "Erro ao remover dia");
        return;
      }
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
    <div className="space-y-4">
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-caption text-danger"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Fechar"
            className="rounded p-0.5 hover:bg-danger/10"
          >
            ×
          </button>
        </div>
      )}
      <div className="space-y-6">
        {localDays.map((day) => {
          const dt = computeDayTotals(day);
          const hasItems = dt.kcal > 0;
          const totalMacroKcal = dt.protein * 4 + dt.carb * 4 + dt.fat * 9 || 1;
          const pPct = Math.round((dt.protein * 4 * 100) / totalMacroKcal);
          const cPct = Math.round((dt.carb * 4 * 100) / totalMacroKcal);
          const fPct = 100 - pPct - cPct;

          return (
            <section
              key={day.id}
              className="rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]"
            >
              <header className="group/dayheader border-b border-border-subtle bg-bg-subtle px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="group/daylabel flex items-center gap-2 text-h3 font-semibold text-text-primary">
                    <CalendarDays
                      className="h-4 w-4 shrink-0 text-text-muted"
                      strokeWidth={1.75}
                    />
                    {editingDayId === day.id ? (
                      <input
                        ref={dayLabelInputRef}
                        type="text"
                        maxLength={60}
                        value={dayLabelValue}
                        onChange={(e) => setDayLabelValue(e.target.value)}
                        onBlur={() => commitDayLabelEdit(day.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitDayLabelEdit(day.id);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelDayLabelEdit();
                          }
                        }}
                        className="rounded border border-brand-primary bg-bg-surface px-2 py-0.5 text-h3 font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        aria-label="Rótulo do dia"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startDayLabelEdit(day)}
                        disabled={pending}
                        title="Clique para renomear o dia"
                        className="flex items-center gap-1 rounded px-0.5 transition-colors hover:bg-bg-subtle disabled:pointer-events-none"
                      >
                        {day.dayLabel}
                        <Pencil
                          className="h-3 w-3 text-text-muted opacity-0 transition-opacity group-hover/daylabel:opacity-100"
                          strokeWidth={1.75}
                        />
                      </button>
                    )}
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasItems && (
                      <>
                        <span className="tabular-nums text-tiny font-medium text-text-primary">
                          {dt.kcal.toFixed(0)} kcal
                        </span>
                        <MacroPill
                          color="var(--color-macro-protein)"
                          label="PTN"
                          value={`${dt.protein.toFixed(0)}g`}
                        />
                        <MacroPill
                          color="var(--color-macro-carb)"
                          label="CHO"
                          value={`${dt.carb.toFixed(0)}g`}
                        />
                        <MacroPill
                          color="var(--color-macro-fat)"
                          label="LIP"
                          value={`${dt.fat.toFixed(0)}g`}
                        />
                        <span className="hidden text-tiny text-text-muted sm:inline">
                          ·
                        </span>
                      </>
                    )}
                    <span className="text-tiny font-medium uppercase tracking-wider text-text-muted tabular-nums">
                      {day.meals.length}{" "}
                      {day.meals.length === 1 ? "refeição" : "refeições"}
                    </span>
                    {day.meals.length > 1 && (
                      <span className="hidden text-tiny text-text-muted sm:inline">
                        · arraste para reordenar
                      </span>
                    )}

                    {/* Delete day — guard: only when >1 day */}
                    {localDays.length > 1 &&
                      (confirmingDeleteDayId === day.id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-tiny text-danger">
                            Excluir dia?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDay(day.id)}
                            disabled={pending}
                            className="inline-flex items-center gap-0.5 rounded bg-danger px-2 py-0.5 text-tiny font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteDayId(null)}
                            disabled={pending}
                            className="inline-flex items-center rounded p-0.5 text-text-muted hover:text-text-primary disabled:opacity-50"
                            aria-label="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteDayId(day.id)}
                          disabled={pending}
                          aria-label={`Excluir ${day.dayLabel}`}
                          title="Excluir dia"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-danger-bg hover:text-danger disabled:opacity-50 group-hover/dayheader:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      ))}
                  </div>
                </div>

                {/* Stacked macro bar */}
                {hasItems && (
                  <div className="mt-2 flex h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
                    <div
                      style={{
                        width: `${pPct}%`,
                        backgroundColor: "var(--color-macro-protein)",
                      }}
                      title={`Proteína ${pPct}%`}
                    />
                    <div
                      style={{
                        width: `${cPct}%`,
                        backgroundColor: "var(--color-macro-carb)",
                      }}
                      title={`Carboidrato ${cPct}%`}
                    />
                    <div
                      style={{
                        width: `${fPct}%`,
                        backgroundColor: "var(--color-macro-fat)",
                      }}
                      title={`Lipídeo ${fPct}%`}
                    />
                  </div>
                )}
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
                        canDelete={day.meals.length > 1}
                        onToggleOpen={(id) =>
                          setOpenMealId((prev) => (prev === id ? null : id))
                        }
                        onAddItem={handleAddItem}
                        onRemoveItem={handleRemoveItem}
                        onUpdateQuantity={handleUpdateQuantity}
                        onUpdateNotes={handleUpdateNotes}
                        onUpdateName={handleUpdateMealName}
                        onUpdateScheduledTime={handleUpdateMealScheduledTime}
                        onDelete={handleDeleteMeal}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add meal inline form */}
              {addingMealDayId === day.id ? (
                <div className="border-t border-border-subtle bg-bg-subtle p-4">
                  <p className="mb-2 text-tiny font-medium text-text-secondary">
                    Nova refeição
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={addMealInputRef}
                      type="text"
                      maxLength={80}
                      placeholder="Nome (ex: Lanche da tarde)"
                      value={addMealName}
                      onChange={(e) => setAddMealName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (addMealName.trim())
                            handleAddMeal(day.id, addMealName, addMealTime);
                        }
                        if (e.key === "Escape") {
                          setAddingMealDayId(null);
                          setAddMealName("");
                          setAddMealTime("");
                        }
                      }}
                      autoFocus
                      className="h-8 flex-1 rounded-md border border-border-default bg-bg-surface px-3 text-body text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
                    />
                    <input
                      type="time"
                      value={addMealTime}
                      onChange={(e) => setAddMealTime(e.target.value)}
                      className="h-8 w-28 rounded-md border border-border-default bg-bg-surface px-2 text-body tabular-nums text-text-primary focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (addMealName.trim())
                          handleAddMeal(day.id, addMealName, addMealTime);
                      }}
                      disabled={!addMealName.trim() || pending}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-primary px-3 text-tiny font-medium text-white disabled:opacity-50 hover:bg-brand-primary-hover"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      Adicionar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingMealDayId(null);
                        setAddMealName("");
                        setAddMealTime("");
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border-default px-3 text-tiny text-text-secondary hover:bg-bg-surface-hover"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border-subtle px-4 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddMealName("");
                      setAddMealTime("");
                      setAddingMealDayId(day.id);
                      setTimeout(() => addMealInputRef.current?.focus(), 20);
                    }}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-tiny text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary disabled:pointer-events-none"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Adicionar refeição
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Add day */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleAddDay}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border-default px-4 py-2.5 text-tiny text-text-muted transition-colors hover:border-brand-primary hover:bg-brand-primary-bg hover:text-brand-primary disabled:pointer-events-none"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Adicionar dia
        </button>
      </div>
    </div>
  );
}

// ── Day totals helper ─────────────────────────────────────────────────────────
function computeDayTotals(day: DayView): {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
} {
  let kcal = 0,
    protein = 0,
    carb = 0,
    fat = 0;
  for (const meal of day.meals) {
    for (const item of meal.items) {
      if (item.kcal) kcal += parseFloat(item.kcal.toString());
      if (item.proteinG) protein += parseFloat(item.proteinG.toString());
      if (item.carbG) carb += parseFloat(item.carbG.toString());
      if (item.fatG) fat += parseFloat(item.fatG.toString());
    }
  }
  return { kcal, protein, carb, fat };
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
