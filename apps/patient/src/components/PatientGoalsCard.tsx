"use client";

import { useState, useEffect, useTransition } from "react";
import { Target, Check, Loader2 } from "lucide-react";
import {
  listPatientGoalsAction,
  updatePatientGoalProgressAction,
  type PatientGoalView,
} from "@/app/app/metas/actions";

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function computeProgress(g: PatientGoalView): number | null {
  const { startValue: s, targetValue: t, currentValue: c, direction } = g;
  if (s === null || t === null || c === null) return null;
  if (direction === "MAINTAIN") {
    const denom = Math.abs(s - t);
    if (denom < 1e-9) return c === t ? 100 : 0;
    return Math.round(clamp(100 - (Math.abs(c - t) / denom) * 100));
  }
  const denom = t - s;
  if (Math.abs(denom) < 1e-9) return c === t ? 100 : 0;
  return Math.round(clamp(((c - s) / denom) * 100));
}

function fmt(v: number | null, unit: string | null): string {
  if (v === null) return "—";
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

function GoalRow({
  goal,
  onSaved,
}: {
  goal: PatientGoalView;
  onSaved: (id: string, value: number) => void;
}) {
  const [draft, setDraft] = useState(
    goal.currentValue !== null ? String(goal.currentValue) : "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const progress = computeProgress(goal);
  const hasTracking = goal.startValue !== null && goal.targetValue !== null;

  function save() {
    const value = Number(draft.replace(",", "."));
    if (!Number.isFinite(value)) {
      setError("Número inválido");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updatePatientGoalProgressAction({
        goalId: goal.id,
        currentValue: value,
      });
      if (r.ok) onSaved(goal.id, value);
      else setError(r.message ?? "Erro");
    });
  }

  return (
    <li className="rounded-md border border-border-subtle bg-bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-medium text-text-primary">
            {goal.title}
          </p>
          <p className="text-tiny text-text-muted">{goal.orgName}</p>
        </div>
        {progress !== null && (
          <span className="shrink-0 text-tiny font-semibold tabular-nums text-text-secondary">
            {progress}%
          </span>
        )}
      </div>

      {hasTracking && (
        <>
          <div className="mt-2 flex items-center justify-between text-tiny text-text-muted tabular-nums">
            <span>{fmt(goal.startValue, goal.unit)}</span>
            <span>alvo {fmt(goal.targetValue, goal.unit)}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full rounded-full bg-brand-primary transition-all"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
        </>
      )}

      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-tiny text-text-muted">
            Valor atual{goal.unit ? ` (${goal.unit})` : ""}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            disabled={pending}
            placeholder="—"
            className="mt-0.5 w-full rounded-md border border-border-default bg-bg-surface px-2.5 py-1.5 text-body tabular-nums focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={save}
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
      {error && <p className="mt-1 text-tiny text-danger">{error}</p>}
    </li>
  );
}

export function PatientGoalsCard() {
  const [goals, setGoals] = useState<PatientGoalView[] | null>(null);

  useEffect(() => {
    let active = true;
    listPatientGoalsAction().then((g) => {
      if (active) setGoals(g);
    });
    return () => {
      active = false;
    };
  }, []);

  // Não renderiza nada se ainda carregando ou sem metas (evita seção vazia).
  if (goals === null || goals.length === 0) return null;

  function handleSaved(id: string, value: number) {
    setGoals(
      (prev) =>
        prev?.map((g) => (g.id === id ? { ...g, currentValue: value } : g)) ??
        null,
    );
  }

  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
        <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
        Suas metas
      </h2>
      <ul className="space-y-2">
        {goals.map((g) => (
          <GoalRow key={g.id} goal={g} onSaved={handleSaved} />
        ))}
      </ul>
    </section>
  );
}
