"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnthropometryChartRecord {
  /** ISO date string (e.g. "2025-03-14") serialized from Date on the server. */
  measuredAt: string;
  weightKg: string | null;
  bodyMassIndex: string | null;
  bodyFatPctCalc: string | null;
  basalMetabolismMifflin: string | null;
}

interface Props {
  /** Records in DESC order (newest first) — same ordering as the page query. */
  records: AnthropometryChartRecord[];
}

// ─── Metric config ────────────────────────────────────────────────────────────

type MetricKey = "weight" | "bmi" | "fatPct" | "geb";

interface MetricConfig {
  label: string;
  unit: string;
  color: string;
  field: keyof AnthropometryChartRecord;
  decimals: number;
  toDisplay: (v: number) => string;
}

const METRICS: Record<MetricKey, MetricConfig> = {
  weight: {
    label: "Peso",
    unit: "kg",
    color: "var(--color-brand-primary)",
    field: "weightKg",
    decimals: 1,
    toDisplay: (v) => v.toFixed(1),
  },
  bmi: {
    label: "IMC",
    unit: "",
    color: "var(--color-info, #3b82f6)",
    field: "bodyMassIndex",
    decimals: 1,
    toDisplay: (v) => v.toFixed(1),
  },
  fatPct: {
    label: "%GC",
    unit: "%",
    color: "var(--color-warning)",
    field: "bodyFatPctCalc",
    decimals: 1,
    toDisplay: (v) => v.toFixed(1),
  },
  geb: {
    label: "GEB (kcal)",
    unit: "kcal",
    color: "var(--color-success)",
    field: "basalMetabolismMifflin",
    decimals: 0,
    toDisplay: (v) => Math.round(v).toLocaleString("pt-BR"),
  },
};

// ─── Chart point interface ─────────────────────────────────────────────────────

interface ChartPoint {
  dateLabel: string; // "DD/MM/YY"
  value: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // "2025-03-14" → "14/03/25"
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y!.slice(2)}`;
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  unit,
  toDisplay,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
  toDisplay: (v: number) => string;
}) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-tiny shadow-md">
      <p className="text-text-muted">{label}</p>
      <p className="tabular-nums font-semibold text-text-primary">
        {toDisplay(payload[0].value)}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

/**
 * AnthropometryChart — full Recharts line chart for metric history.
 * Shown only when ≥ 3 records exist.
 * Provides a metric selector (Peso / IMC / %GC / GEB).
 */
export function AnthropometryChart({ records }: Props) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("weight");

  // Records arrive DESC; reverse to chronological for the chart
  const chronRecords = useMemo(() => [...records].reverse(), [records]);

  // Build chart data for the active metric
  const { points, hasData, first, last } = useMemo(() => {
    const cfg = METRICS[activeMetric];
    const pts: ChartPoint[] = chronRecords.map((r) => {
      const raw = r[cfg.field] as string | null;
      return {
        dateLabel: formatDate(r.measuredAt),
        value: raw != null ? parseFloat(raw) : null,
      };
    });
    const values = pts
      .map((p) => p.value)
      .filter((v): v is number => v !== null);
    return {
      points: pts,
      hasData: values.length >= 3,
      first: values.length > 0 ? values[0] : null,
      last: values.length > 0 ? values[values.length - 1] : null,
    };
  }, [chronRecords, activeMetric]);

  // Which metric buttons to show (only those with ≥ 1 data point)
  const availableMetrics = useMemo((): MetricKey[] => {
    const all: MetricKey[] = ["weight", "bmi", "fatPct", "geb"];
    return all.filter((k) => {
      const field = METRICS[k].field;
      return chronRecords.some((r) => r[field] != null);
    });
  }, [chronRecords]);

  if (records.length < 3) return null;
  if (availableMetrics.length === 0) return null;

  // Ensure activeMetric is valid
  const metric = availableMetrics.includes(activeMetric)
    ? activeMetric
    : availableMetrics[0]!;
  const cfg = METRICS[metric];

  // Y-axis domain with 5% padding
  const numericValues = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const minVal = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 100;
  const pad = (maxVal - minVal) * 0.1 || 1;
  const domain: [number, number] = [
    Math.floor((minVal - pad) * 10) / 10,
    Math.ceil((maxVal + pad) * 10) / 10,
  ];

  // Delta summary
  const delta = first != null && last != null ? last - first : null;
  const deltaLabel =
    delta != null
      ? `${delta > 0 ? "+" : ""}${cfg.toDisplay(delta)}${cfg.unit ? ` ${cfg.unit}` : ""}`
      : null;

  return (
    <section
      aria-label="Gráfico de evolução antropométrica"
      className="mb-6 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]"
    >
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Evolução — {records.length} medições
          </h2>
          {deltaLabel && (
            <p className="mt-0.5 text-tiny text-text-secondary">
              Variação total:{" "}
              <span
                className={`tabular-nums font-medium ${
                  delta === null
                    ? "text-text-secondary"
                    : delta > 0.05
                      ? "text-text-primary"
                      : delta < -0.05
                        ? "text-text-primary"
                        : "text-text-muted"
                }`}
              >
                {deltaLabel}
              </span>
            </p>
          )}
        </div>

        {/* Metric selector */}
        <div
          role="group"
          aria-label="Selecionar métrica"
          className="flex flex-wrap gap-1"
        >
          {availableMetrics.map((key) => {
            const isActive = metric === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveMetric(key)}
                aria-pressed={isActive}
                className={`rounded-md px-2.5 py-1 text-tiny font-medium transition-colors ${
                  isActive
                    ? "bg-brand-primary text-white"
                    : "bg-bg-subtle text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {METRICS[key].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {!hasData ? (
        <p className="py-8 text-center text-tiny text-text-muted">
          Dados insuficientes para o gráfico de {cfg.label.toLowerCase()}.
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-subtle)"
                vertical={false}
              />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={domain}
                tickFormatter={(v: number) =>
                  cfg.unit === "kcal"
                    ? Math.round(v).toLocaleString("pt-BR")
                    : v.toFixed(cfg.decimals)
                }
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickLine={false}
                axisLine={false}
                width={cfg.unit === "kcal" ? 44 : 36}
                unit={cfg.unit !== "kcal" ? cfg.unit : undefined}
              />
              {/* Reference line at first measurement for visual context */}
              {first != null && (
                <ReferenceLine
                  y={first}
                  stroke="var(--color-border-default)"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                />
              )}
              <Tooltip
                content={
                  <CustomTooltip unit={cfg.unit} toDisplay={cfg.toDisplay} />
                }
                cursor={{
                  stroke: "var(--color-border-default)",
                  strokeWidth: 1,
                  strokeDasharray: "4 2",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={cfg.color}
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx: number;
                    cy: number;
                    payload: ChartPoint;
                  };
                  if (payload.value == null)
                    return <g key={`dot-null-${cx}`} />;
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="var(--color-bg-surface)"
                      stroke={cfg.color}
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 5, stroke: cfg.color, strokeWidth: 2 }}
                connectNulls={false}
                name={cfg.label}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
