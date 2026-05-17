import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { MealPlanEditor } from "./MealPlanEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editor plano alimentar" };

interface Props {
  params: Promise<{ id: string; planId: string }>;
}

export default async function MealPlanEditorPage({ params }: Props) {
  const { id, planId } = await params;

  let data: {
    patient: { id: string; fullName: string };
    plan: {
      id: string;
      name: string;
      status: string;
      targetKcal: { toString: () => string } | null;
      totalCostCents: number | null;
      days: Array<{
        id: string;
        dayLabel: string;
        meals: Array<{
          id: string;
          name: string;
          scheduledTime: string | null;
          items: Array<{
            id: string;
            quantityG: { toString: () => string };
            preparationNotes: string | null;
            kcal: { toString: () => string } | null;
            proteinG: { toString: () => string } | null;
            carbG: { toString: () => string } | null;
            fatG: { toString: () => string } | null;
            food: { id: string; name: string; source: string };
          }>;
        }>;
      }>;
    };
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;

      const plan = await tx.mealPlan.findFirst({
        where: { id: planId, patientId: id },
        include: {
          days: {
            orderBy: { sortOrder: "asc" },
            include: {
              meals: {
                orderBy: { sortOrder: "asc" },
                include: {
                  items: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                      food: { select: { id: true, name: true, source: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!plan) return null;
      return { patient, plan };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();

  // Calcular totais do plano (soma de todos os items de todas as meals de todos os days)
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarb = 0;
  let totalFat = 0;
  for (const day of data.plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        if (item.kcal) totalKcal += Number(item.kcal);
        if (item.proteinG) totalProtein += Number(item.proteinG);
        if (item.carbG) totalCarb += Number(item.carbG);
        if (item.fatG) totalFat += Number(item.fatG);
      }
    }
  }

  const target = data.plan.targetKcal ? Number(data.plan.targetKcal) : null;
  const pctOfTarget = target ? Math.round((totalKcal / target) * 100) : null;

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/app/patients/${id}/meal-plans`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← Planos de {data.patient.fullName}
        </Link>

        <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {data.plan.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Paciente: {data.patient.fullName} • Status:{" "}
              <span className="font-medium">{data.plan.status}</span>
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-right shadow-sm">
            <div className="text-2xl font-bold text-teal-700 tabular-nums">
              {totalKcal.toFixed(0)} kcal
            </div>
            {target && (
              <div className="text-xs text-slate-500">
                Meta: {target.toFixed(0)} kcal ({pctOfTarget}%)
              </div>
            )}
            <div className="mt-2 text-xs text-slate-600 tabular-nums">
              PTN <strong>{totalProtein.toFixed(0)}g</strong> · CHO{" "}
              <strong>{totalCarb.toFixed(0)}g</strong> · LIP{" "}
              <strong>{totalFat.toFixed(0)}g</strong>
            </div>
          </div>
        </header>

        <div className="mt-6">
          <MealPlanEditor
            patientId={id}
            planId={planId}
            days={data.plan.days}
          />
        </div>
      </div>
    </main>
  );
}
