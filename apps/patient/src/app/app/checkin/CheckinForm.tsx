"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCheckinAction } from "./actions";

interface Props {
  todayISO: string;
  initial: {
    mood: number | null;
    energyLevel: number | null;
    hungerLevel: number | null;
    waterMl: number | null;
    weightKg: number | null;
    followedPlan: boolean | null;
    notes: string | null;
  } | null;
}

const MOOD_LABELS = ["😞", "😕", "😐", "🙂", "😄"];
const SCALE_LABELS = ["Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"];

export function CheckinForm({ todayISO, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ streak: number } | null>(null);

  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(
    initial?.energyLevel ?? null,
  );
  const [hunger, setHunger] = useState<number | null>(
    initial?.hungerLevel ?? null,
  );
  const [waterMl, setWaterMl] = useState<string>(
    initial?.waterMl?.toString() ?? "",
  );
  const [weight, setWeight] = useState<string>(
    initial?.weightKg?.toString() ?? "",
  );
  const [followedPlan, setFollowedPlan] = useState<boolean | null>(
    initial?.followedPlan ?? null,
  );
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("checkinDate", todayISO);
    if (mood !== null) formData.set("mood", mood.toString());
    if (energy !== null) formData.set("energyLevel", energy.toString());
    if (hunger !== null) formData.set("hungerLevel", hunger.toString());
    if (waterMl) formData.set("waterMl", waterMl);
    if (weight) formData.set("weightKg", weight);
    if (followedPlan !== null)
      formData.set("followedPlan", followedPlan ? "true" : "false");
    if (notes.trim()) formData.set("notes", notes.trim());

    startTransition(async () => {
      const r = await upsertCheckinAction(formData);
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      setSuccess({ streak: r.checkin?.streak ?? 0 });
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center">
        <p className="text-5xl">🎉</p>
        <p className="mt-3 text-lg font-semibold text-green-900">
          Check-in registrado!
        </p>
        <p className="mt-2 text-sm text-green-800">
          🔥 <strong>{success.streak}</strong> dia(s) consecutivos
        </p>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-4 text-xs text-green-700 underline"
        >
          Editar resposta
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      {/* Humor */}
      <div>
        <label className="block text-sm font-medium text-slate-800">
          Como você está se sentindo hoje?
        </label>
        <div className="mt-2 flex justify-between gap-2">
          {MOOD_LABELS.map((emoji, i) => {
            const value = i + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMood(mood === value ? null : value)}
                className={`flex-1 rounded-lg border p-3 text-3xl transition ${
                  mood === value
                    ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
                aria-label={`Humor ${value} de 5`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </div>

      {/* Energia */}
      <ScaleSelector
        label="Energia ao longo do dia"
        value={energy}
        onChange={setEnergy}
      />

      {/* Fome */}
      <ScaleSelector label="Fome geral" value={hunger} onChange={setHunger} />

      {/* Água */}
      <div>
        <label
          htmlFor="waterMl"
          className="block text-sm font-medium text-slate-800"
        >
          💧 Água bebida (ml)
        </label>
        <input
          id="waterMl"
          type="number"
          inputMode="numeric"
          min="0"
          max="20000"
          step="50"
          value={waterMl}
          onChange={(e) => setWaterMl(e.target.value)}
          placeholder="ex: 2000"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        />
        <p className="mt-1 text-xs text-slate-500">
          Recomendado: 35ml por kg de peso/dia
        </p>
      </div>

      {/* Peso */}
      <div>
        <label
          htmlFor="weight"
          className="block text-sm font-medium text-slate-800"
        >
          ⚖️ Peso hoje (kg) — opcional
        </label>
        <input
          id="weight"
          type="number"
          inputMode="decimal"
          min="20"
          max="400"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="ex: 70.5"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      {/* Plano seguido */}
      <div>
        <label className="block text-sm font-medium text-slate-800">
          🍽️ Você seguiu o plano alimentar hoje?
        </label>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setFollowedPlan(followedPlan === true ? null : true)}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
              followedPlan === true
                ? "border-green-500 bg-green-50 text-green-800 ring-2 ring-green-500"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            ✅ Sim
          </button>
          <button
            type="button"
            onClick={() =>
              setFollowedPlan(followedPlan === false ? null : false)
            }
            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
              followedPlan === false
                ? "border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            ⚠️ Em parte
          </button>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-slate-800"
        >
          Observações (opcional)
        </label>
        <textarea
          id="notes"
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Algo importante sobre seu dia, treino, sono..."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">{notes.length} / 500</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-md bg-teal-700 px-4 py-3 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {pending
          ? "Salvando..."
          : initial
            ? "Atualizar check-in"
            : "Salvar check-in"}
      </button>
    </form>
  );
}

function ScaleSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="mt-2 flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v ? null : v)}
            className={`flex-1 rounded-md border py-2 text-xs font-medium transition ${
              value === v
                ? "border-teal-500 bg-teal-100 text-teal-900 ring-1 ring-teal-500"
                : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            <div>{v}</div>
            <div className="text-[10px] font-normal opacity-70">
              {SCALE_LABELS[v - 1]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
