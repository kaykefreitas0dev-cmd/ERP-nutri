"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Plus, Trash2, Loader2, Utensils, Check } from "lucide-react";
import {
  addDiaryEntryAction,
  listDiaryEntriesAction,
  deleteDiaryEntryAction,
  type DiaryEntryView,
} from "./actions";

const MEAL_LABELS = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
  "Outro",
];

function todayStr(): string {
  // Data local YYYY-MM-DD
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function formatDay(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function DiaryClient() {
  const [entries, setEntries] = useState<DiaryEntryView[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(todayStr());
  const [mealLabel, setMealLabel] = useState(MEAL_LABELS[0]);
  const [description, setDescription] = useState("");
  const [followedPlan, setFollowedPlan] = useState<"" | "yes" | "no">("");

  const reload = useCallback(async () => {
    const list = await listDiaryEntriesAction(7);
    setEntries(list);
  }, []);

  useEffect(() => {
    let active = true;
    listDiaryEntriesAction(7).then((l) => {
      if (active) setEntries(l);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 1) {
      setError("Descreva o que você comeu");
      return;
    }
    startTransition(async () => {
      const r = await addDiaryEntryAction({
        entryDate,
        mealLabel: mealLabel ?? "Outro",
        description: description.trim(),
        followedPlan:
          followedPlan === "" ? null : followedPlan === "yes" ? true : false,
      });
      if (r.ok) {
        setDescription("");
        setFollowedPlan("");
        await reload();
      } else {
        setError(r.message ?? "Erro ao salvar");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteDiaryEntryAction(id);
      if (r.ok) await reload();
    });
  }

  // Agrupar por data
  const grouped = new Map<string, DiaryEntryView[]>();
  for (const e of entries ?? []) {
    const arr = grouped.get(e.entryDate) ?? [];
    arr.push(e);
    grouped.set(e.entryDate, arr);
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary";

  return (
    <div className="space-y-6">
      {/* Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]"
      >
        <h2 className="text-h3 font-semibold text-text-primary">
          Registrar refeição
        </h2>
        {error && (
          <div
            role="alert"
            className="mt-3 rounded-md bg-danger-bg p-3 text-body text-danger"
          >
            {error}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="d-date" className="block text-tiny font-medium">
              Data
            </label>
            <input
              id="d-date"
              type="date"
              value={entryDate}
              max={todayStr()}
              onChange={(e) => setEntryDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="d-meal" className="block text-tiny font-medium">
              Refeição
            </label>
            <select
              id="d-meal"
              value={mealLabel}
              onChange={(e) => setMealLabel(e.target.value)}
              className={inputCls}
            >
              {MEAL_LABELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label htmlFor="d-desc" className="block text-tiny font-medium">
            O que você comeu?
          </label>
          <textarea
            id="d-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Ex: 2 ovos mexidos, 1 fatia de pão integral, café sem açúcar"
            className={inputCls}
          />
        </div>
        <div className="mt-2">
          <label htmlFor="d-plan" className="block text-tiny font-medium">
            Seguiu o plano nesta refeição?
          </label>
          <select
            id="d-plan"
            value={followedPlan}
            onChange={(e) =>
              setFollowedPlan(e.target.value as "" | "yes" | "no")
            }
            className={inputCls}
          >
            <option value="">Não informar</option>
            <option value="yes">Sim, segui</option>
            <option value="no">Não segui</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2} />
          )}
          Adicionar ao diário
        </button>
      </form>

      {/* Lista agrupada por dia */}
      {entries === null ? (
        <p className="text-center text-caption text-text-muted">Carregando…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-8 text-center">
          <Utensils
            className="mx-auto h-7 w-7 text-text-muted"
            strokeWidth={1.5}
          />
          <p className="mt-2 text-body font-medium text-text-secondary">
            Seu diário está vazio
          </p>
          <p className="mt-1 text-tiny text-text-muted">
            Registre o que comeu para acompanhar sua alimentação com seu
            nutricionista.
          </p>
        </div>
      ) : (
        [...grouped.entries()].map(([date, items]) => (
          <section key={date}>
            <h3 className="mb-2 text-tiny font-semibold uppercase tracking-wider text-text-muted tabular-nums">
              {formatDay(date)}
            </h3>
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="group flex items-start gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-medium text-text-primary">
                        {it.mealLabel}
                      </span>
                      {it.followedPlan === true && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-success-bg px-1.5 py-0.5 text-tiny text-success">
                          <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                          seguiu
                        </span>
                      )}
                      {it.followedPlan === false && (
                        <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-tiny text-warning">
                          fora do plano
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-caption text-text-secondary">
                      {it.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(it.id)}
                    disabled={pending}
                    aria-label="Excluir registro"
                    className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-all hover:bg-danger-bg hover:text-danger disabled:opacity-50 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
