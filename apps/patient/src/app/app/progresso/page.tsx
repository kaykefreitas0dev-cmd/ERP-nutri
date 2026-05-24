import Link from "next/link";
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowLeft,
  Ruler,
  Activity,
  Flame,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu progresso — NutriCore" };

const BMI_CLASS: Array<{
  max: number;
  label: string;
  color: "success" | "warning" | "danger" | "info";
}> = [
  { max: 18.5, label: "Abaixo do peso", color: "info" },
  { max: 25, label: "Peso adequado", color: "success" },
  { max: 30, label: "Sobrepeso", color: "warning" },
  { max: 35, label: "Obesidade I", color: "danger" },
  { max: 40, label: "Obesidade II", color: "danger" },
  { max: Infinity, label: "Obesidade III", color: "danger" },
];

function getBmiClass(bmi: number) {
  return BMI_CLASS.find((c) => bmi < c.max) ?? BMI_CLASS[BMI_CLASS.length - 1]!;
}

function fmtDecimal(v: { toString: () => string } | null): string {
  if (!v) return "—";
  const n = parseFloat(v.toString());
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function delta(
  curr: number,
  prev: number,
): { sign: "up" | "down" | "same"; value: string } {
  const diff = curr - prev;
  if (Math.abs(diff) < 0.05) return { sign: "same", value: "0.0" };
  return { sign: diff > 0 ? "up" : "down", value: Math.abs(diff).toFixed(1) };
}

export default async function ProgressoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Busca medições do paciente (ordenado mais novo primeiro)
  const measurements = await prisma.anthropometry.findMany({
    where: {
      patient: { userId: user!.id, status: { not: "ANONYMIZED" } },
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
      basalMetabolismMifflin: true,
      leanMassKgCalc: true,
    },
  });

  const latest = measurements[0] ?? null;
  const previous = measurements[1] ?? null;

  const latestWeight = latest?.weightKg
    ? parseFloat(latest.weightKg.toString())
    : null;
  const prevWeight = previous?.weightKg
    ? parseFloat(previous.weightKg.toString())
    : null;
  const latestBmi = latest?.bodyMassIndex
    ? parseFloat(latest.bodyMassIndex.toString())
    : null;
  const bmiClass = latestBmi ? getBmiClass(latestBmi) : null;

  const weightDelta =
    latestWeight !== null && prevWeight !== null
      ? delta(latestWeight, prevWeight)
      : null;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      {/* Back */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-tiny text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Início
      </Link>

      <h1 className="mt-3 text-h1 font-bold tracking-tight text-text-primary">
        Meu progresso
      </h1>

      {measurements.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default py-12 text-center">
          <Scale className="h-10 w-10 text-text-muted" strokeWidth={1.25} />
          <p className="text-body font-medium text-text-secondary">
            Nenhuma medição registrada ainda
          </p>
          <p className="max-w-xs text-tiny text-text-muted">
            Seu nutricionista ainda não adicionou medições de antropometria.
            Elas aparecerão aqui após a sua consulta de avaliação.
          </p>
        </div>
      ) : (
        <>
          {/* Latest summary */}
          <section className="mt-5 grid grid-cols-2 gap-3">
            {/* Peso */}
            <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
              <div className="flex items-center justify-between">
                <p className="text-tiny text-text-muted">Peso atual</p>
                <Scale className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
                {latestWeight !== null ? `${latestWeight.toFixed(1)}kg` : "—"}
              </p>
              {weightDelta && (
                <p
                  className={
                    "mt-1 flex items-center gap-1 text-tiny font-medium " +
                    (weightDelta.sign === "down"
                      ? "text-success"
                      : weightDelta.sign === "up"
                        ? "text-warning"
                        : "text-text-muted")
                  }
                >
                  {weightDelta.sign === "down" ? (
                    <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : weightDelta.sign === "up" ? (
                    <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {weightDelta.sign === "down"
                    ? "-"
                    : weightDelta.sign === "up"
                      ? "+"
                      : ""}
                  {weightDelta.value}kg vs anterior
                </p>
              )}
            </div>

            {/* IMC */}
            <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
              <div className="flex items-center justify-between">
                <p className="text-tiny text-text-muted">IMC</p>
                <Activity
                  className="h-4 w-4 text-text-muted"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
                {latestBmi !== null ? latestBmi.toFixed(1) : "—"}
              </p>
              {bmiClass && (
                <p
                  className={
                    "mt-1 text-tiny font-medium " +
                    (bmiClass.color === "success"
                      ? "text-success"
                      : bmiClass.color === "warning"
                        ? "text-warning"
                        : bmiClass.color === "danger"
                          ? "text-danger"
                          : "text-info")
                  }
                >
                  {bmiClass.label}
                </p>
              )}
            </div>

            {/* Altura */}
            {latest?.heightCm && (
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
                <div className="flex items-center justify-between">
                  <p className="text-tiny text-text-muted">Altura</p>
                  <Ruler
                    className="h-4 w-4 text-text-muted"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
                  {fmtDecimal(latest.heightCm)}cm
                </p>
              </div>
            )}

            {/* GEB / Metabolismo basal */}
            {latest?.basalMetabolismMifflin && (
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
                <div className="flex items-center justify-between">
                  <p className="text-tiny text-text-muted">Metabolismo basal</p>
                  <Flame className="h-4 w-4 text-warning" strokeWidth={1.75} />
                </div>
                <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
                  {fmtDecimal(latest.basalMetabolismMifflin)}
                  <span className="text-body font-normal text-text-muted">
                    kcal
                  </span>
                </p>
                <p className="mt-1 text-tiny text-text-muted">
                  Mifflin-St Jeor
                </p>
              </div>
            )}
          </section>

          {/* Última medição */}
          {latest && (
            <p className="mt-3 text-tiny text-text-muted">
              Última medição:{" "}
              {new Date(latest.measuredAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          {/* Histórico */}
          {measurements.length > 1 && (
            <section className="mt-6">
              <h2 className="text-body font-semibold text-text-primary">
                Histórico ({measurements.length} medições)
              </h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
                <table className="w-full text-body">
                  <thead className="border-b border-border-subtle bg-bg-subtle">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                        Data
                      </th>
                      <th className="px-3 py-2.5 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                        Peso (kg)
                      </th>
                      <th className="px-3 py-2.5 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                        IMC
                      </th>
                      {measurements.some((m) => m.bodyFatPctCalc) && (
                        <th className="px-3 py-2.5 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                          %GC
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {measurements.map((m, i) => {
                      const isLatest = i === 0;
                      const weight = m.weightKg
                        ? parseFloat(m.weightKg.toString())
                        : null;
                      const bmi = m.bodyMassIndex
                        ? parseFloat(m.bodyMassIndex.toString())
                        : null;
                      const prevM = measurements[i + 1];
                      const prevW = prevM?.weightKg
                        ? parseFloat(prevM.weightKg.toString())
                        : null;
                      const wDelta =
                        weight !== null && prevW !== null
                          ? delta(weight, prevW)
                          : null;

                      return (
                        <tr
                          key={m.id}
                          className={isLatest ? "bg-brand-primary-bg/20" : ""}
                        >
                          <td className="px-3 py-2.5 text-tiny text-text-secondary">
                            {new Date(m.measuredAt).toLocaleDateString(
                              "pt-BR",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                            {isLatest && (
                              <span className="ml-1 text-[9px] font-semibold text-brand-primary">
                                atual
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className="font-medium text-text-primary">
                              {weight !== null ? weight.toFixed(1) : "—"}
                            </span>
                            {wDelta && (
                              <span
                                className={
                                  "ml-1.5 text-[10px] " +
                                  (wDelta.sign === "down"
                                    ? "text-success"
                                    : wDelta.sign === "up"
                                      ? "text-warning"
                                      : "text-text-muted")
                                }
                              >
                                {wDelta.sign === "down"
                                  ? "▼"
                                  : wDelta.sign === "up"
                                    ? "▲"
                                    : "—"}
                                {wDelta.value}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
                            {bmi !== null ? bmi.toFixed(1) : "—"}
                          </td>
                          {measurements.some((mm) => mm.bodyFatPctCalc) && (
                            <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
                              {m.bodyFatPctCalc
                                ? `${parseFloat(m.bodyFatPctCalc.toString()).toFixed(1)}%`
                                : "—"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Nota clínica */}
          <p className="mt-6 rounded-lg border border-border-subtle bg-bg-subtle px-4 py-3 text-tiny text-text-muted">
            As medições são registradas pelo seu nutricionista durante as
            consultas. Em caso de dúvidas, entre em contato.
          </p>
        </>
      )}
    </div>
  );
}
