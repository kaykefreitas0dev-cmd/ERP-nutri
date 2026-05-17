import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { AnthropometryForm } from "./AnthropometryForm";

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
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/patients/${id}`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← Voltar para {data.patient.fullName}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Antropometria
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Histórico de medições. Cálculos automáticos: IMC, GEB
          (Mifflin/Harris/FAO), %GC (Pollock).
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form coluna 1-2 */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
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
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Histórico ({data.records.length})
            </h2>
            {data.records.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                Nenhuma medição registrada.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.records.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="font-medium text-slate-900">
                      {new Date(r.measuredAt).toLocaleDateString("pt-BR")}
                    </div>
                    <dl className="mt-1 space-y-0.5 text-slate-600">
                      {r.weightKg && (
                        <div>
                          Peso:{" "}
                          <span className="font-medium">
                            {r.weightKg.toString()}kg
                          </span>
                        </div>
                      )}
                      {r.bodyMassIndex && (
                        <div>
                          IMC:{" "}
                          <span className="font-medium">
                            {r.bodyMassIndex.toString()}
                          </span>
                        </div>
                      )}
                      {r.bodyFatPctCalc && (
                        <div>
                          %GC:{" "}
                          <span className="font-medium">
                            {r.bodyFatPctCalc.toString()}%
                          </span>
                        </div>
                      )}
                      {r.basalMetabolismMifflin && (
                        <div>
                          GEB:{" "}
                          <span className="font-medium">
                            {r.basalMetabolismMifflin.toString()} kcal
                          </span>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
