import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, LineChart, Activity } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { AnthropometryForm } from "./AnthropometryForm";
import { AnthropometryTrend } from "./AnthropometryTrend";
import { AnthropometryChart } from "./AnthropometryChart";
import { DeleteAnthropometryButton } from "./DeleteAnthropometryButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Antropometria" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnthropometryPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: {
      id: string;
      fullName: string;
      biologicalSex: string | null;
      birthDate: Date | null;
    };
    records: Array<{
      id: string;
      measuredAt: Date;
      protocol: string;
      weightKg: { toString: () => string } | null;
      heightCm: { toString: () => string } | null;
      bodyMassIndex: { toString: () => string } | null;
      bodyFatPctCalc: { toString: () => string } | null;
      basalMetabolismMifflin: { toString: () => string } | null;
    }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: {
          id: true,
          fullName: true,
          biologicalSex: true,
          birthDate: true,
        },
      });
      if (!patient) return null;
      const records = await tx.anthropometry.findMany({
        where: { patientId: id },
        orderBy: { measuredAt: "desc" },
        take: 50,
        select: {
          id: true,
          measuredAt: true,
          protocol: true,
          weightKg: true,
          heightCm: true,
          bodyMassIndex: true,
          bodyFatPctCalc: true,
          basalMetabolismMifflin: true,
        },
      });
      return { patient, records };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/patients/${id}`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {data.patient.fullName}
        </Link>
        <header className="mt-3">
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Avaliação física
          </p>
          <h1 className="mt-0.5 flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
            <Activity
              className="h-6 w-6 text-text-secondary"
              strokeWidth={1.75}
            />
            Antropometria
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Histórico de medições com cálculos automáticos: IMC, GEB
            (Mifflin/Harris/FAO), %GC (Pollock).
          </p>
        </header>

        {data.records.length >= 2 && (
          <div className="mt-6">
            <AnthropometryTrend
              records={data.records.map((r) => ({
                weightKg: r.weightKg?.toString() ?? null,
                bodyMassIndex: r.bodyMassIndex?.toString() ?? null,
                bodyFatPctCalc: r.bodyFatPctCalc?.toString() ?? null,
                basalMetabolismMifflin:
                  r.basalMetabolismMifflin?.toString() ?? null,
              }))}
            />
          </div>
        )}

        {data.records.length >= 3 && (
          <AnthropometryChart
            records={data.records.map((r) => ({
              measuredAt: r.measuredAt.toISOString(),
              weightKg: r.weightKg?.toString() ?? null,
              bodyMassIndex: r.bodyMassIndex?.toString() ?? null,
              bodyFatPctCalc: r.bodyFatPctCalc?.toString() ?? null,
              basalMetabolismMifflin:
                r.basalMetabolismMifflin?.toString() ?? null,
            }))}
          />
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form coluna 1-2 */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)]">
              <h2 className="text-h3 font-semibold text-text-primary">
                Nova medição
              </h2>
              <AnthropometryForm
                patientId={id}
                patientSex={data.patient.biologicalSex}
                patientBirthDate={data.patient.birthDate}
              />
            </div>
          </div>

          {/* Histórico coluna 3 */}
          <aside>
            <h2 className="mb-3 flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
              <LineChart className="h-3.5 w-3.5" strokeWidth={1.75} />
              Histórico ({data.records.length})
            </h2>
            {data.records.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-default p-4 text-center text-caption text-text-muted">
                Nenhuma medição registrada ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.records.map((r) => {
                  const dateLabel = new Date(r.measuredAt).toLocaleDateString(
                    "pt-BR",
                  );
                  return (
                    <li
                      key={r.id}
                      className="group relative rounded-md border border-border-subtle bg-bg-surface p-3 [box-shadow:var(--shadow-xs)]"
                    >
                      <div className="pr-6 text-body font-semibold text-text-primary tabular-nums">
                        {dateLabel}
                      </div>
                      <dl className="mt-2 space-y-1 text-tiny text-text-secondary">
                        {r.weightKg && (
                          <MeasurementRow
                            label="Peso"
                            value={`${r.weightKg.toString()} kg`}
                          />
                        )}
                        {r.bodyMassIndex && (
                          <MeasurementRow
                            label="IMC"
                            value={r.bodyMassIndex.toString()}
                          />
                        )}
                        {r.bodyFatPctCalc && (
                          <MeasurementRow
                            label="%GC"
                            value={`${r.bodyFatPctCalc.toString()}%`}
                          />
                        )}
                        {r.basalMetabolismMifflin && (
                          <MeasurementRow
                            label="GEB"
                            value={`${r.basalMetabolismMifflin.toString()} kcal`}
                          />
                        )}
                      </dl>
                      <DeleteAnthropometryButton
                        recordId={r.id}
                        patientId={id}
                        dateLabel={dateLabel}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function MeasurementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary tabular-nums">
        {value}
      </span>
    </div>
  );
}
