"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus } from "lucide-react";
import { createGoalAction } from "./actions";
import {
  GOAL_TYPES,
  GOAL_DIRECTIONS,
  GOAL_TYPE_LABEL,
  GOAL_DIRECTION_LABEL,
} from "./goal-utils";

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function GoalForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof GOAL_TYPES)[number]>("WEIGHT");
  const [direction, setDirection] =
    useState<(typeof GOAL_DIRECTIONS)[number]>("DECREASE");
  const [startValue, setStartValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("kg");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setTitle("");
    setStartValue("");
    setTargetValue("");
    setDueDate("");
    setDescription("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 2) {
      setError("Dê um título à meta (mín. 2 caracteres)");
      return;
    }
    startTransition(async () => {
      const result = await createGoalAction({
        patientId,
        title: title.trim(),
        type,
        direction,
        startValue: parseNum(startValue),
        targetValue: parseNum(targetValue),
        unit: unit.trim() || undefined,
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
      });
      if (result.ok) {
        reset();
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao criar meta");
      }
    });
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary";

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <h2 className="flex items-center gap-1.5 text-h3 font-semibold text-text-primary">
        <Target className="h-4 w-4 text-brand-primary" strokeWidth={1.75} />
        Nova meta
      </h2>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-danger-bg p-3 text-body text-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="goal-title" className="block text-tiny font-medium">
            Título *
          </label>
          <input
            id="goal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            placeholder="Ex: Chegar a 75kg"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="goal-type" className="block text-tiny font-medium">
              Tipo
            </label>
            <select
              id="goal-type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as (typeof GOAL_TYPES)[number])
              }
              className={inputCls}
            >
              {GOAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {GOAL_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="goal-direction"
              className="block text-tiny font-medium"
            >
              Direção
            </label>
            <select
              id="goal-direction"
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as (typeof GOAL_DIRECTIONS)[number])
              }
              className={inputCls}
            >
              {GOAL_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {GOAL_DIRECTION_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="goal-start" className="block text-tiny font-medium">
              Início
            </label>
            <input
              id="goal-start"
              type="text"
              inputMode="decimal"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              placeholder="90"
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="goal-target"
              className="block text-tiny font-medium"
            >
              Alvo
            </label>
            <input
              id="goal-target"
              type="text"
              inputMode="decimal"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="75"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="goal-unit" className="block text-tiny font-medium">
              Unidade
            </label>
            <input
              id="goal-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
              placeholder="kg"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="goal-due" className="block text-tiny font-medium">
            Prazo (opcional)
          </label>
          <input
            id="goal-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="goal-desc" className="block text-tiny font-medium">
            Observações (opcional)
          </label>
          <textarea
            id="goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Contexto, estratégia, etc."
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {pending ? "Criando…" : "Criar meta"}
        </button>
      </form>
    </div>
  );
}
