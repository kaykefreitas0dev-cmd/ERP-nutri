import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Target, Wallet, Utensils } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { NewMealPlanForm } from "./NewMealPlanForm";
import { DuplicateMealPlanButton } from "./DuplicateMealPlanButton";

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
            Nutrição
          </p>
          <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
            Planos alimentares
          </h1>
          <p className="mt-1 text-caption text-text-secondary tabular-nums">
            {data.plans.length} plano{data.plans.length === 1 ? "" : "s"}{" "}
            registrado{data.plans.length === 1 ? "" : "s"}
          </p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {data.plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
                  <Utensils className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-h3 font-semibold text-text-primary">
                  Nenhum plano ainda
                </p>
                <p className="mt-1 text-caption text-text-secondary">
                  Crie o primeiro plano alimentar para{" "}
                  {data.patient.fullName.split(" ")[0]} usando o formulário ao
                  lado.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {data.plans.map((p) => (
                  <li
                    key={p.id}
                    className="group rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)] transition-all duration-fast hover:[box-shadow:var(--shadow-sm)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary">
                          <Utensils className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/app/patients/${id}/meal-plans/${p.id}`}
                            className="text-body font-semibold text-text-primary transition-colors hover:text-brand-primary"
                          >
                            {p.name}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-tiny text-text-muted">
                            {p.targetKcal && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Target
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                />
                                {p.targetKcal.toString()} kcal/dia
                              </span>
                            )}
                            {p.totalCostCents != null &&
                              p.totalCostCents > 0 && (
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Wallet
                                    className="h-3 w-3"
                                    strokeWidth={1.75}
                                  />
                                  R${" "}
                                  {(p.totalCostCents / 100)
                                    .toFixed(2)
                                    .replace(".", ",")}{" "}
                                  estimado
                                </span>
                              )}
                            <span className="tabular-nums">
                              · Atualizado{" "}
                              {new Date(p.updatedAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={
                          "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                          (p.status === "ACTIVE"
                            ? "bg-success-bg text-success ring-success-border"
                            : p.status === "DRAFT"
                              ? "bg-warning-bg text-warning ring-warning-border"
                              : "bg-bg-subtle text-text-secondary ring-border-subtle")
                        }
                      >
                        {p.status}
                      </span>
                    </div>
                    <DuplicateMealPlanButton
                      planId={p.id}
                      patientId={id}
                      originalName={p.name}
                    />
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
