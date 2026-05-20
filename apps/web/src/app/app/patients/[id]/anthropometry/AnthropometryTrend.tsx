"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Sparkline } from "@/components/dashboard/Sparkline";

interface TrendRecord {
  weightKg: string | null;
  bodyMassIndex: string | null;
  bodyFatPctCalc: string | null;
  basalMetabolismMifflin: string | null;
}

interface Props {
  /** Records in DESC order (newest first) — same as page.tsx query. */
  records: TrendRecord[];
}

/**
 * Trend stat card with a mini-sparkline.
 * Delta is shown neutrally (no semantic green/red) because clinical
 * context determines whether a change is "good" or "bad".
 */
function TrendCard({
  label,
  current,
  unit,
  data,
  color,
}: {
  label: string;
  current: number;
  unit: string;
  data: number[];
  color: string;
}) {
  const prev = data.length >= 2 ? data[data.length - 2] : null;
  const delta = prev !== null ? current - prev : null;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-h2 font-semibold tabular-nums text-text-primary">
        {unit === "kcal"
          ? Math.round(current).toLocaleString("pt-BR")
          : current.toFixed(1)}
        <span className="ml-1 text-body font-normal text-text-secondary">
          {unit}
        </span>
      </p>

      {delta !== null && (
        <div className="mt-1 flex items-center gap-1 text-tiny text-text-secondary">
          {delta > 0.05 ? (
            <TrendingUp
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
          ) : delta < -0.05 ? (
            <TrendingDown
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
          ) : (
            <Minus
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
          )}
          <span className="tabular-nums">
            {delta > 0 ? "+" : ""}
            {unit === "kcal"
              ? Math.round(delta).toLocaleString("pt-BR")
              : delta.toFixed(1)}{" "}
            {unit}
          </span>
          <span className="text-text-subtle">vs anterior</span>
        </div>
      )}

      {data.length >= 2 && (
        <div className="mt-3 h-9 w-full opacity-60 transition-opacity duration-fast group-hover:opacity-100">
          <Sparkline data={data} color={color} />
        </div>
      )}
    </div>
  );
}

/**
 * AnthropometryTrend — rendered only when ≥2 records exist.
 * Shows weight / BMI / %GC / GEB sparkline trend cards.
 */
export function AnthropometryTrend({ records }: Props) {
  if (records.length < 2) return null;

  // Records arrive in DESC order; reverse to chronological for sparklines
  const chron = [...records].reverse();

  const weights = chron
    .map((r) => (r.weightKg ? parseFloat(r.weightKg) : null))
    .filter((v): v is number => v !== null);

  const bmis = chron
    .map((r) => (r.bodyMassIndex ? parseFloat(r.bodyMassIndex) : null))
    .filter((v): v is number => v !== null);

  const fatPcts = chron
    .map((r) => (r.bodyFatPctCalc ? parseFloat(r.bodyFatPctCalc) : null))
    .filter((v): v is number => v !== null);

  const gebs = chron
    .map((r) =>
      r.basalMetabolismMifflin ? parseFloat(r.basalMetabolismMifflin) : null,
    )
    .filter((v): v is number => v !== null);

  const cards: React.ReactElement[] = [];

  if (weights.length >= 2) {
    cards.push(
      <TrendCard
        key="weight"
        label="Peso"
        current={weights[weights.length - 1]}
        unit="kg"
        data={weights}
        color="var(--color-brand-primary)"
      />,
    );
  }

  if (bmis.length >= 2) {
    cards.push(
      <TrendCard
        key="bmi"
        label="IMC"
        current={bmis[bmis.length - 1]}
        unit=""
        data={bmis}
        color="var(--color-brand-primary)"
      />,
    );
  }

  if (fatPcts.length >= 2) {
    cards.push(
      <TrendCard
        key="fatpct"
        label="%GC calculado"
        current={fatPcts[fatPcts.length - 1]}
        unit="%"
        data={fatPcts}
        color="var(--color-warning)"
      />,
    );
  }

  if (gebs.length >= 2) {
    cards.push(
      <TrendCard
        key="geb"
        label="GEB (Mifflin)"
        current={gebs[gebs.length - 1]}
        unit="kcal"
        data={gebs}
        color="var(--color-success)"
      />,
    );
  }

  if (cards.length === 0) return null;

  return (
    <section aria-label="Tendências de antropometria" className="mb-6">
      <h2 className="mb-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
        Tendência ({records.length} medições)
      </h2>
      <div
        className={`grid gap-3 ${
          cards.length === 4
            ? "grid-cols-2 md:grid-cols-4"
            : cards.length === 3
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-2"
        }`}
      >
        {cards}
      </div>
    </section>
  );
}
