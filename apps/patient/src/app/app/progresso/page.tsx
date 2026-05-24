import { redirect } from "next/navigation";
import {
  Scale,
  Ruler,
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu progresso" };

function fmtDecimal(v: unknown): string {
  if (v == null) return "—";
  const n = Number(v);
  return isNaN(n) ? "—" : n.toFixed(1);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function delta(
  current: unknown,
  previous: unknown,
): { value: string; positive: boolean; neutral: boolean } | null {
  if (current == null || previous == null) return null;
  const diff = Number(current) - Number(previous);
  if (isNaN(diff) || Math.abs(diff) < 0.05) return null;
  return {
    value: (diff > 0 ? "+" : "") + diff.toFixed(1),
    positive: diff > 0,
    neutral: false,
  };
}

// BMI classification (WHO)
const BMI_CLASSES = [
  { max: 18.5, label: "Abaixo do peso", color: "text-info" },
  { max: 25.0, label: "Peso adequado", color: "text-success" },
  { max: 30.0, label: "Sobrepeso", color: "text-warning" },
  { max: 35.0, label: "Obesidade I", color: "text-danger" },
  { max: 40.0, label: "Obesidade II", color: "text-danger" },
  { max: Infinity, label: "Obesidade III", color: "text-danger" },
];

function getBmiClass(bmi: unknown): { label: string; color: string } | null {
  if (bmi == null) return null;
  const n = Number(bmi);
  if (isNaN(n)) return null;
  return BMI_CLASSES.find((c) => n < c.max) ?? null;
}

export default async function ProgressoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // CORREÇÃO QA #55: middleware normalmente redireciona, mas defense-in-depth
  // contra race entre middleware e render (cookie expirar in-flight).
  if (!user) {
    redirect("/login?redirectTo=/app/progresso");
  }

  const measurements = await prisma.anthropometry.findMany({
    where: {
      patient: {
        userId: user.id,
        status: { not: "ANONYMIZED" },
      },
    },
    orderBy: { measuredAt: "desc" },
    take: 30,
    select: {
      id: true,
      measuredAt: true,
      weightKg: true,
      heightCm: true,
      bodyMassIndex: true,
      bodyFatPctCalc: true,
      leanMassKgCalc: true,
      basalMetabolismMifflin: true,
    },
  });

  const latest = measurements[0] ?? null;
  const prev = measurements[1] ?? null;

  const bmiClass = getBmiClass(latest?.bodyMassIndex);

  // Reversed for chronological display in chart/list
  const chronological = [...measurements].reverse();

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-24">
      <header>
        <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
          Meu corpo
        </p>
        <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
          Progresso
        </h1>
        <p className="mt-1 text-caption text-text-secondary">
          Histórico das suas avaliações físicas.
        </p>
      </header>

      {measurements.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-bg-subtle px-6 py-10 text-center">
          <Scale
            className="mx-auto mb-3 h-8 w-8 text-text-muted"
            strokeWidth={1.25}
          />
          <p className="text-body font-medium text-text-primary">
            Nenhuma avaliação registrada
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            Seu nutricionista irá registrar suas medidas na próxima consulta.
          </p>
        </div>
      ) : (
        <>
          {/* ── Resumo mais recente ─────────────────────────────────── */}
          <section className="mt-6">
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Última avaliação · {fmtDate(latest!.measuredAt)}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Peso */}
              <SummaryCard
                icon={Scale}
                label="Peso"
                value={
                  latest?.weightKg ? `${fmtDecimal(latest.weightKg)} kg` : "—"
                }
                delta={delta(latest?.weightKg, prev?.weightKg)}
                deltaPositiveIsGood={false}
              />

              {/* IMC */}
              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
                <p className="text-tiny text-text-muted">IMC</p>
                <p className="mt-0.5 text-h2 font-semibold tabular-nums text-text-primary">
                  {fmtDecimal(latest?.bodyMassIndex)}
                </p>
                {bmiClass && (
                  <p
                    className={`mt-0.5 text-tiny font-medium ${bmiClass.color}`}
                  >
                    {bmiClass.label}
                  </p>
                )}
              </div>

              {/* % Gordura */}
              <SummaryCard
                icon={Activity}
                label="% Gordura"
                value={
                  latest?.bodyFatPctCalc
                    ? `${fmtDecimal(latest.bodyFatPctCalc)}%`
                    : "—"
                }
                delta={delta(latest?.bodyFatPctCalc, prev?.bodyFatPctCalc)}
                deltaPositiveIsGood={false}
              />

              {/* Altura */}
              <SummaryCard
                icon={Ruler}
                label="Altura"
                value={
                  latest?.heightCm ? `${fmtDecimal(latest.heightCm)} cm` : "—"
                }
                delta={null}
                deltaPositiveIsGood={true}
              />
            </div>
          </section>

          {/* ── Histórico de medições ────────────────────────────────── */}
          {measurements.length > 1 && (
            <section className="mt-8">
              <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Histórico ({measurements.length} avaliações)
              </h2>

              {/* Peso sparkline simplificado */}
              {measurements.some((m) => m.weightKg != null) && (
                <WeightSparkline measurements={chronological} />
              )}

              {/* Tabela */}
              <ul className="mt-3 space-y-2">
                {measurements.map((m, i) => {
                  const prevM = measurements[i + 1];
                  const wDelta = delta(m.weightKg, prevM?.weightKg);
                  return (
                    <li
                      key={m.id}
                      className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-caption font-medium text-text-primary">
                          {fmtDate(m.measuredAt)}
                        </span>
                        {m.weightKg && (
                          <span className="flex items-center gap-1.5 text-body font-semibold tabular-nums text-text-primary">
                            {fmtDecimal(m.weightKg)} kg
                            {wDelta && (
                              <span
                                className={
                                  "text-tiny font-medium tabular-nums " +
                                  (wDelta.positive
                                    ? "text-danger"
                                    : "text-success")
                                }
                              >
                                {wDelta.value}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-tiny text-text-secondary tabular-nums">
                        {m.bodyMassIndex != null && (
                          <span>IMC {fmtDecimal(m.bodyMassIndex)}</span>
                        )}
                        {m.bodyFatPctCalc != null && (
                          <span>G {fmtDecimal(m.bodyFatPctCalc)}%</span>
                        )}
                        {m.leanMassKgCalc != null && (
                          <span>MM {fmtDecimal(m.leanMassKgCalc)} kg</span>
                        )}
                        {m.basalMetabolismMifflin != null && (
                          <span>
                            GEB {Number(m.basalMetabolismMifflin).toFixed(0)}{" "}
                            kcal
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  delta: d,
  deltaPositiveIsGood,
}: {
  icon: typeof Scale;
  label: string;
  value: string;
  delta: { value: string; positive: boolean; neutral: boolean } | null;
  deltaPositiveIsGood: boolean;
}) {
  const isGood = d ? d.positive === deltaPositiveIsGood : null;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny text-text-muted">{label}</p>
      <p className="mt-0.5 text-h2 font-semibold tabular-nums text-text-primary">
        {value}
      </p>
      {d && (
        <p
          className={
            "mt-0.5 flex items-center gap-0.5 text-tiny font-medium tabular-nums " +
            (isGood ? "text-success" : "text-danger")
          }
        >
          {d.positive ? (
            <TrendingUp className="h-3 w-3" strokeWidth={2} />
          ) : (
            <TrendingDown className="h-3 w-3" strokeWidth={2} />
          )}
          {d.value}
        </p>
      )}
      {!d && (
        <p className="mt-0.5 flex items-center gap-0.5 text-tiny text-text-muted">
          <Minus className="h-3 w-3" strokeWidth={2} />
          sem anterior
        </p>
      )}
    </div>
  );
}

type MeasurementSlim = {
  measuredAt: Date;
  weightKg: unknown;
};

function WeightSparkline({
  measurements,
}: {
  measurements: MeasurementSlim[];
}) {
  const weights = measurements
    .map((m) => (m.weightKg != null ? Number(m.weightKg) : null))
    .filter((v): v is number => v != null);

  if (weights.length < 2) return null;

  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 100;
  const H = 40;
  const step = W / (weights.length - 1);

  const pts = weights
    .map((w, i) => {
      const x = i * step;
      const y = H - ((w - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny text-text-muted">
        Evolução do peso ({weights.length} medições)
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-10 w-full"
          aria-hidden="true"
        >
          <polyline
            points={pts}
            fill="none"
            stroke="var(--color-brand-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="shrink-0 text-right">
          <p className="text-tiny tabular-nums text-text-muted">
            {min.toFixed(1)} – {max.toFixed(1)} kg
          </p>
        </div>
      </div>
    </div>
  );
}
