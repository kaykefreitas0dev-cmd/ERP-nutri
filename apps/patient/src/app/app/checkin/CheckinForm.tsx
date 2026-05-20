"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Frown,
  Annoyed,
  Meh,
  Smile,
  SmilePlus,
  Droplets,
  Scale,
  UtensilsCrossed,
  CircleCheck,
  TriangleAlert,
  Sparkles,
  Flame,
  type LucideIcon,
} from "lucide-react";
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

const MOOD_ICONS: Array<{ Icon: LucideIcon; label: string }> = [
  { Icon: Frown, label: "Muito mal" },
  { Icon: Annoyed, label: "Mal" },
  { Icon: Meh, label: "Neutro" },
  { Icon: Smile, label: "Bem" },
  { Icon: SmilePlus, label: "Ótimo" },
];

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
      <div className="rounded-lg border border-success-border bg-success-bg p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <Sparkles className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <p className="mt-3 text-h3 font-semibold text-success">
          Check-in registrado!
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-body text-success">
          <Flame className="h-4 w-4" strokeWidth={1.75} />
          <strong className="tabular-nums">{success.streak}</strong> dia(s)
          consecutivos
        </p>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-4 text-tiny text-success underline-offset-2 hover:underline"
        >
          Editar resposta
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]"
    >
      {/* Humor */}
      <div>
        <label className="block text-body font-medium text-text-primary">
          Como você está se sentindo hoje?
        </label>
        <div className="mt-2 flex justify-between gap-2">
          {MOOD_ICONS.map(({ Icon, label }, i) => {
            const value = i + 1;
            const selected = mood === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMood(mood === value ? null : value)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 transition ${
                  selected
                    ? "border-brand-primary bg-brand-primary-bg text-brand-primary ring-2 ring-brand-primary"
                    : "border-border-subtle bg-bg-surface text-text-muted hover:border-border-default hover:text-text-secondary"
                }`}
                aria-label={`Humor ${value} de 5 — ${label}`}
                aria-pressed={selected}
              >
                <Icon className="h-7 w-7" strokeWidth={1.5} />
                <span className="text-[10px] font-medium">{label}</span>
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
          className="flex items-center gap-2 text-body font-medium text-text-primary"
        >
          <Droplets
            className="h-4 w-4"
            strokeWidth={1.75}
            style={{ color: "var(--color-macro-water)" }}
          />
          Água bebida (ml)
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
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-base tabular-nums text-text-primary"
        />
        <p className="mt-1 text-tiny text-text-muted">
          Recomendado: 35ml por kg de peso/dia
        </p>
      </div>

      {/* Peso */}
      <div>
        <label
          htmlFor="weight"
          className="flex items-center gap-2 text-body font-medium text-text-primary"
        >
          <Scale className="h-4 w-4" strokeWidth={1.75} />
          Peso hoje (kg) — opcional
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
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-base tabular-nums text-text-primary"
        />
      </div>

      {/* Plano seguido */}
      <div>
        <label className="flex items-center gap-2 text-body font-medium text-text-primary">
          <UtensilsCrossed className="h-4 w-4" strokeWidth={1.75} />
          Você seguiu o plano alimentar hoje?
        </label>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setFollowedPlan(followedPlan === true ? null : true)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-body font-medium transition ${
              followedPlan === true
                ? "border-success bg-success-bg text-success ring-2 ring-success"
                : "border-border-default bg-bg-surface text-text-secondary hover:border-border-strong"
            }`}
            aria-pressed={followedPlan === true}
          >
            <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
            Sim
          </button>
          <button
            type="button"
            onClick={() =>
              setFollowedPlan(followedPlan === false ? null : false)
            }
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-body font-medium transition ${
              followedPlan === false
                ? "border-warning bg-warning-bg text-warning ring-2 ring-warning"
                : "border-border-default bg-bg-surface text-text-secondary hover:border-border-strong"
            }`}
            aria-pressed={followedPlan === false}
          >
            <TriangleAlert className="h-4 w-4" strokeWidth={1.75} />
            Em parte
          </button>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label
          htmlFor="notes"
          className="block text-body font-medium text-text-primary"
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
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary"
        />
        <p className="mt-1 text-tiny text-text-muted tabular-nums">
          {notes.length} / 500
        </p>
      </div>

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-md bg-brand-primary px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-50"
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
      <label className="block text-body font-medium text-text-primary">
        {label}
      </label>
      <div className="mt-2 flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v ? null : v)}
            className={`flex-1 rounded-md border py-2 text-tiny font-medium transition ${
              value === v
                ? "border-brand-primary bg-brand-primary-bg text-brand-primary ring-1 ring-brand-primary"
                : "border-border-default bg-bg-surface text-text-secondary hover:border-border-strong"
            }`}
            aria-pressed={value === v}
          >
            <div className="tabular-nums">{v}</div>
            <div className="text-[10px] font-normal opacity-70">
              {SCALE_LABELS[v - 1]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
