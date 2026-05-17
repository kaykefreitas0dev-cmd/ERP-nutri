import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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

  const proteinKcal = totalProtein * 4;
  const carbKcal = totalCarb * 4;
  const fatKcal = totalFat * 9;
  const totalMacroKcal = proteinKcal + carbKcal + fatKcal || 1;
  const proteinPct = Math.round((proteinKcal / totalMacroKcal) * 100);
  const carbPct = Math.round((carbKcal / totalMacroKcal) * 100);
  const fatPct = Math.round((fatKcal / totalMacroKcal) * 100);

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/app/patients/${id}/meal-plans`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Planos de {data.patient.fullName}
        </Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Plano alimentar
            </p>
            <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
              {data.plan.name}
            </h1>
            <p className="mt-1 inline-flex items-center gap-2 text-caption text-text-secondary">
              {data.patient.fullName}
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                  (data.plan.status === "ACTIVE"
                    ? "bg-success-bg text-success ring-success-border"
                    : data.plan.status === "DRAFT"
                      ? "bg-warning-bg text-warning ring-warning-border"
                      : "bg-bg-subtle text-text-secondary ring-border-subtle")
                }
              >
                {data.plan.status}
              </span>
            </p>
          </div>

          <div className="min-w-[280px] rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
            <div className="flex items-baseline justify-between">
              <span className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Total
              </span>
              {target && (
                <span className="text-tiny tabular-nums text-text-muted">
                  meta {target.toFixed(0)}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-h1 font-semibold tabular-nums text-text-primary">
                {totalKcal.toFixed(0)}
              </span>
              <span className="text-caption text-text-secondary">kcal</span>
              {pctOfTarget != null && (
                <span
                  className={
                    "ml-auto rounded-full px-2 py-0.5 text-tiny font-medium tabular-nums ring-1 ring-inset " +
                    (pctOfTarget >= 95 && pctOfTarget <= 105
                      ? "bg-success-bg text-success ring-success-border"
                      : pctOfTarget < 80 || pctOfTarget > 120
                        ? "bg-warning-bg text-warning ring-warning-border"
                        : "bg-bg-subtle text-text-secondary ring-border-subtle")
                  }
                >
                  {pctOfTarget}%
                </span>
              )}
            </div>

            {/* Stacked macros bar */}
            <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
              <div
                style={{
                  width: `${proteinPct}%`,
                  backgroundColor: "var(--color-macro-protein)",
                }}
                title={`Proteína ${proteinPct}%`}
              />
              <div
                style={{
                  width: `${carbPct}%`,
                  backgroundColor: "var(--color-macro-carb)",
                }}
                title={`Carboidrato ${carbPct}%`}
              />
              <div
                style={{
                  width: `${fatPct}%`,
                  backgroundColor: "var(--color-macro-fat)",
                }}
                title={`Lipídeo ${fatPct}%`}
              />
            </div>

            {/* Macros legenda */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-tiny tabular-nums">
              <MacroChip
                color="var(--color-macro-protein)"
                label="PTN"
                value={`${totalProtein.toFixed(0)}g`}
              />
              <MacroChip
                color="var(--color-macro-carb)"
                label="CHO"
                value={`${totalCarb.toFixed(0)}g`}
              />
              <MacroChip
                color="var(--color-macro-fat)"
                label="LIP"
                value={`${totalFat.toFixed(0)}g`}
              />
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

function MacroChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-bg-subtle px-2 py-1">
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-text-muted">{label}</span>
      <span className="ml-auto font-medium text-text-primary">{value}</span>
    </div>
  );
}
