"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleCheck,
  Ban,
  Trash2,
  RotateCcw,
  Loader2,
  CalendarClock,
} from "lucide-react";
import {
  updateGoalProgressAction,
  updateGoalStatusAction,
  deleteGoalAction,
} from "./actions";
import {
  computeGoalProgress,
  formatGoalValue,
  GOAL_TYPE_LABEL,
  GOAL_DIRECTION_LABEL,
  GOAL_STATUS_LABEL,
  type GoalView,
} from "./goal-utils";

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Prazo nos próximos 7 dias? (helper de módulo p/ manter o render puro)
 *  dueDate é date-only (YYYY-MM-DD) → parse como UTC para evitar shift de fuso. */
function isDueSoon(dueDate: string): boolean {
  return (
    new Date(dueDate + "T00:00:00Z").getTime() - Date.now() < 7 * 24 * 3600_000
  );
}

/** YYYY-MM-DD → DD/MM/YYYY sem conversão de fuso (campo é date-only). */
function formatDueDate(dueDate: string): string {
  return dueDate.split("-").reverse().join("/");
}

export function GoalCard({
  goal,
  patientId,
}: {
  goal: GoalView;
  patientId: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<number | null>(goal.currentValue);
  const [draft, setDraft] = useState(
    goal.currentValue !== null ? String(goal.currentValue) : "",
  );
  const [status, setStatus] = useState(goal.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const progress = computeGoalProgress({
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    currentValue: current,
    direction: goal.direction,
  });

  const isActive = status === "ACTIVE";
  const hasTracking = goal.startValue !== null && goal.targetValue !== null;

  function handleSaveProgress() {
    const value = parseNum(draft);
    if (value === null) {
      setError("Informe um número válido");
      return;
    }
    setError(null);
    const prev = current;
    setCurrent(value);
    startTransition(async () => {
      const result = await updateGoalProgressAction({
        goalId: goal.id,
        patientId,
        currentValue: value,
      });
      if (!result.ok) {
        setCurrent(prev);
        setError(result.message ?? "Erro ao salvar");
      } else {
        router.refresh();
      }
    });
  }

  function handleStatus(next: "ACTIVE" | "ACHIEVED" | "ABANDONED") {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const result = await updateGoalStatusAction({
        goalId: goal.id,
        patientId,
        status: next,
      });
      if (!result.ok) {
        setStatus(prev);
        setError(result.message ?? "Erro");
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir a meta "${goal.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteGoalAction({ goalId: goal.id, patientId });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao excluir");
      }
    });
  }

  const statusCls =
    status === "ACHIEVED"
      ? "bg-success-bg text-success ring-success-border"
      : status === "ABANDONED"
        ? "bg-bg-subtle text-text-muted ring-border-subtle"
        : "bg-warning-bg text-warning ring-warning-border";

  const dueLabel = goal.dueDate ? formatDueDate(goal.dueDate) : null;
  const dueSoon = goal.dueDate && isActive ? isDueSoon(goal.dueDate) : false;

  return (
    <li
      className={
        "rounded-lg border bg-bg-surface p-4 [box-shadow:var(--shadow-xs)] " +
        (status === "ABANDONED"
          ? "border-border-subtle opacity-70"
          : "border-border-subtle")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body font-semibold text-text-primary">
              {goal.title}
            </h3>
            <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny text-text-secondary ring-1 ring-inset ring-border-subtle">
              {GOAL_TYPE_LABEL[goal.type] ?? goal.type}
            </span>
            <span
              className={
                "rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                statusCls
              }
            >
              {GOAL_STATUS_LABEL[status] ?? status}
            </span>
          </div>
          {goal.description && (
            <p className="mt-1 text-tiny text-text-muted">{goal.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          title="Excluir meta"
          aria-label={`Excluir meta "${goal.title}"`}
          className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Progresso */}
      {hasTracking && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-tiny text-text-muted tabular-nums">
            <span>
              {GOAL_DIRECTION_LABEL[goal.direction] ?? goal.direction}:{" "}
              {formatGoalValue(goal.startValue, goal.unit)} →{" "}
              {formatGoalValue(goal.targetValue, goal.unit)}
            </span>
            {progress !== null && (
              <span className="font-medium text-text-secondary">
                {progress}%
              </span>
            )}
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
            <div
              className={
                "h-full rounded-full transition-all duration-fast " +
                (status === "ACHIEVED" ? "bg-success" : "bg-brand-primary")
              }
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Atualizar valor atual */}
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label
            htmlFor={`goal-current-${goal.id}`}
            className="block text-tiny font-medium text-text-secondary"
          >
            Valor atual{goal.unit ? ` (${goal.unit})` : ""}
          </label>
          <input
            id={`goal-current-${goal.id}`}
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            disabled={pending}
            placeholder="—"
            className="mt-1 w-full rounded-md border border-border-default bg-bg-surface px-2.5 py-1.5 text-body tabular-nums focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={handleSaveProgress}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
          Salvar
        </button>
      </div>

      {error && <p className="mt-2 text-tiny text-danger">{error}</p>}

      {/* Rodapé: prazo + ações de status */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
        {dueLabel ? (
          <span
            className={
              "inline-flex items-center gap-1 text-tiny tabular-nums " +
              (dueSoon ? "text-warning" : "text-text-muted")
            }
          >
            <CalendarClock className="h-3 w-3" strokeWidth={1.75} />
            Prazo {dueLabel}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => handleStatus("ACHIEVED")}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-tiny font-medium text-success transition-colors hover:bg-success-bg disabled:opacity-50"
              >
                <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Concluir
              </button>
              <button
                type="button"
                onClick={() => handleStatus("ABANDONED")}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-tiny text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                Abandonar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleStatus("ACTIVE")}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-tiny text-text-secondary transition-colors hover:bg-bg-subtle disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
              Reativar
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
