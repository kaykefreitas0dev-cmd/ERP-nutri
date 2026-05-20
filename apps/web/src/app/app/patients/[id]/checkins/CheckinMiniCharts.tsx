"use client";

import { Droplets, Zap, Smile, Scale } from "lucide-react";
import { Sparkline } from "@/components/dashboard/Sparkline";
import type { LucideIcon } from "lucide-react";

interface ChartCard {
  label: string;
  Icon: LucideIcon;
  data: number[];
  color: string;
  unit: string;
  /** If provided, shown as y-axis range label. */
  range?: string;
}

function MiniChart({ label, Icon, data, color, unit, range }: ChartCard) {
  if (data.length < 3) return null;
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-tiny font-medium text-text-secondary">
          <Icon
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={1.75}
            style={{ color }}
          />
          {label}
        </p>
        {range && <span className="text-[10px] text-text-subtle">{range}</span>}
      </div>
      <p className="mt-0.5 text-h3 font-semibold tabular-nums text-text-primary">
        {unit === "ml"
          ? Math.round(avg).toLocaleString("pt-BR")
          : avg.toFixed(1)}
        <span className="ml-0.5 text-tiny font-normal text-text-muted">
          {unit}
        </span>
      </p>
      <div className="mt-2 h-10 w-full opacity-70">
        <Sparkline data={data} color={color} />
      </div>
      <p className="mt-1 text-[10px] text-text-subtle">
        {data.length} registros (últimos 30d)
      </p>
    </div>
  );
}

interface Props {
  /** Mood values (1-5), chronological order (oldest → newest). */
  moodData: number[];
  /** Energy values (1-5), chronological. */
  energyData: number[];
  /** Water in ml, chronological. */
  waterData: number[];
  /** Weight in kg (optional — from checkin), chronological. */
  weightData: number[];
}

/**
 * CheckinMiniCharts — renders compact sparkline cards for mood, energy,
 * water, and optional weight trends. Shown only when ≥3 data points exist.
 */
export function CheckinMiniCharts({
  moodData,
  energyData,
  waterData,
  weightData,
}: Props) {
  const cards: ChartCard[] = [];

  if (moodData.length >= 3) {
    cards.push({
      label: "Humor",
      Icon: Smile,
      data: moodData,
      color: "var(--color-brand-primary)",
      unit: "/5",
      range: "1-5",
    });
  }
  if (energyData.length >= 3) {
    cards.push({
      label: "Energia",
      Icon: Zap,
      data: energyData,
      color: "var(--color-warning)",
      unit: "/5",
      range: "1-5",
    });
  }
  if (waterData.length >= 3) {
    cards.push({
      label: "Água",
      Icon: Droplets,
      data: waterData,
      color: "var(--color-macro-water, var(--color-info))",
      unit: "ml",
    });
  }
  if (weightData.length >= 3) {
    cards.push({
      label: "Peso",
      Icon: Scale,
      data: weightData,
      color: "var(--color-success)",
      unit: "kg",
    });
  }

  if (cards.length === 0) return null;

  return (
    <section aria-label="Gráficos de tendência" className="mt-6">
      <h2 className="mb-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
        Tendência — últimos 30 dias
      </h2>
      <div
        className={`grid gap-3 ${
          cards.length >= 4
            ? "grid-cols-2 md:grid-cols-4"
            : cards.length === 3
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-2"
        }`}
      >
        {cards.map((c) => (
          <MiniChart key={c.label} {...c} />
        ))}
      </div>
    </section>
  );
}
