import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { NewMealPlanForm } from "./NewMealPlanForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planos alimentares" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientMealPlansPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: { id: string; fullName: string };
    plans: Array<{
      id: string;
      name: string;
      status: string;
      startDate: Date | null;
      endDate: Date | null;
      targetKcal: { toString: () => string } | null;
      totalCostCents: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;
      const plans = await tx.mealPlan.findMany({
        where: { patientId: id },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          targetKcal: true,
          totalCostCents: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { patient, plans };
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
          className="text-sm text-brand-primary hover:underline"
        >
          ← {data.patient.fullName}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">
          Planos alimentares
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {data.plans.length} plano(s) registrado(s)
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {data.plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-default bg-white p-12 text-center">
                <p className="text-text-secondary">
                  Nenhum plano alimentar criado.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.plans.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-border-subtle bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/app/patients/${id}/meal-plans/${p.id}`}
                          className="text-base font-semibold text-brand-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="mt-1 text-xs text-text-secondary">
                          {p.targetKcal && (
                            <span className="mr-3">
                              🎯 {p.targetKcal.toString()} kcal/dia
                            </span>
                          )}
                          {p.totalCostCents != null && (
                            <span className="mr-3">
                              💰 R${" "}
                              {(p.totalCostCents / 100)
                                .toFixed(2)
                                .replace(".", ",")}{" "}
                              estimado
                            </span>
                          )}
                          <span>
                            Atualizado{" "}
                            {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : p.status === "DRAFT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-bg-muted text-text-secondary"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <NewMealPlanForm patientId={id} />
          </div>
        </div>
      </div>
    </main>
  );
}
