import Link from "next/link";
import { notFound } from "next/navigation";
import { Hospital, Calendar, Utensils, ChevronLeft } from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plano alimentar" };

interface Props {
  params: Promise<{ planId: string }>;
}

export default async function PlanDetailPage({ params }: Props) {
  const { planId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const plan = await prisma.mealPlan.findFirst({
    where: {
      id: planId,
      patient: { userId: user!.id }, // Lock 6 — só vê se for SEU plano
    },
    include: {
      patient: {
        select: {
          fullName: true,
          organization: { select: { name: true } },
        },
      },
      days: {
        orderBy: { sortOrder: "asc" },
        include: {
          meals: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) notFound();

  // Buscar nomes dos foods (via snapshot foodId)
  const allFoodIds = Array.from(
    new Set(
      plan.days.flatMap((d) =>
        d.meals.flatMap((m) => m.items.map((i) => i.foodId)),
      ),
    ),
  );
  const foods = await prisma.food.findMany({
    where: { id: { in: allFoodIds } },
    select: { id: true, name: true },
  });
  const foodMap = new Map(foods.map((f) => [f.id, f.name]));

  // ── Compute per-day totals ───────────────────────────────────────────────
  const dayTotals = plan.days.map((d) => {
    let kcal = 0,
      p = 0,
      c = 0,
      f = 0;
    for (const m of d.meals)
      for (const i of m.items) {
        if (i.kcal) kcal += Number(i.kcal);
        if (i.proteinG) p += Number(i.proteinG);
        if (i.carbG) c += Number(i.carbG);
        if (i.fatG) f += Number(i.fatG);
      }
    return { kcal, p, c, f };
  });

  // Average across days (correct label for the summary card)
  const numDays = Math.max(dayTotals.length, 1);
  const avgKcal = dayTotals.reduce((s, d) => s + d.kcal, 0) / numDays;
  const avgP = dayTotals.reduce((s, d) => s + d.p, 0) / numDays;
  const avgC = dayTotals.reduce((s, d) => s + d.c, 0) / numDays;
  const avgF = dayTotals.reduce((s, d) => s + d.f, 0) / numDays;

  const target = plan.targetKcal ? Number(plan.targetKcal) : null;
  const pct = target ? Math.round((avgKcal / target) * 100) : null;

  // Macros as % of avg kcal
  const proteinKcal = avgP * 4;
  const carbKcal = avgC * 4;
  const fatKcal = avgF * 9;
  const macroSum = proteinKcal + carbKcal + fatKcal || 1;
  const proteinPct = Math.round((proteinKcal / macroSum) * 100);
  const carbPct = Math.round((carbKcal / macroSum) * 100);
  const fatPct = Math.round((fatKcal / macroSum) * 100);

  const isMultiDay = plan.days.length > 1;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <Link
        href="/app/meu-plano"
        className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Meus planos
      </Link>

      <header className="mt-3">
        <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
          Plano alimentar
        </p>
        <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
          {plan.name}
        </h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-caption text-text-secondary">
          <Hospital
            className="h-3.5 w-3.5 text-brand-primary"
            strokeWidth={1.75}
          />
          {plan.patient.organization.name}
        </p>
      </header>

      {/* Card de Total kcal + macros */}
      <div className="mt-4 rounded-lg border border-brand-200 bg-brand-primary-bg p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-tiny font-semibold uppercase tracking-wider text-brand-primary-hover">
            {isMultiDay ? "Média diária" : "Total diário"}
          </p>
          {target && (
            <p className="text-tiny tabular-nums text-brand-primary">
              meta {target.toFixed(0)} kcal
            </p>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-display font-semibold tabular-nums text-brand-primary">
            {avgKcal.toFixed(0)}
          </span>
          <span className="text-caption text-brand-primary-hover">kcal</span>
          {pct != null && (
            <span
              className={
                "ml-auto rounded-full px-2 py-0.5 text-tiny font-medium tabular-nums ring-1 ring-inset " +
                (pct >= 95 && pct <= 105
                  ? "bg-success-bg text-success ring-success-border"
                  : pct < 80 || pct > 120
                    ? "bg-warning-bg text-warning ring-warning-border"
                    : "bg-bg-surface text-text-secondary ring-border-subtle")
              }
            >
              {pct}%
            </span>
          )}
        </div>

        {/* Stacked macro bar */}
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-surface">
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

        <div className="mt-3 grid grid-cols-3 gap-2 text-tiny tabular-nums">
          <MacroChip
            color="var(--color-macro-protein)"
            label="PTN"
            value={`${avgP.toFixed(0)}g`}
          />
          <MacroChip
            color="var(--color-macro-carb)"
            label="CHO"
            value={`${avgC.toFixed(0)}g`}
          />
          <MacroChip
            color="var(--color-macro-fat)"
            label="LIP"
            value={`${avgF.toFixed(0)}g`}
          />
        </div>

        {isMultiDay && (
          <p className="mt-2 text-tiny text-brand-primary-hover opacity-70">
            Média entre {plan.days.length} dias do plano
          </p>
        )}
      </div>

      {/* Dias */}
      <div className="mt-6 space-y-4">
        {plan.days.map((day, dayIdx) => {
          const dt = dayTotals[dayIdx]!;
          const hasMacros = dt.kcal > 0;
          return (
            <section
              key={day.id}
              className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]"
            >
              <header className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-subtle px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-body font-semibold text-text-primary">
                  <Calendar
                    className="h-4 w-4 text-text-muted"
                    strokeWidth={1.75}
                  />
                  {day.dayLabel}
                </h2>
                <div className="flex items-center gap-3 text-tiny tabular-nums">
                  {hasMacros && (
                    <span className="font-medium text-text-primary">
                      {dt.kcal.toFixed(0)} kcal
                    </span>
                  )}
                  <span className="font-medium uppercase tracking-wider text-text-muted">
                    {day.meals.length}{" "}
                    {day.meals.length === 1 ? "refeição" : "refeições"}
                  </span>
                </div>
              </header>

              <div className="divide-y divide-border-subtle">
                {day.meals.map((meal) => {
                  let mKcal = 0;
                  for (const it of meal.items)
                    if (it.kcal) mKcal += Number(it.kcal);
                  return (
                    <div key={meal.id} className="px-4 py-3">
                      <header className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="flex flex-wrap items-center gap-2 text-body font-semibold text-text-primary">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-primary-bg text-brand-primary">
                            <Utensils
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                          </span>
                          {meal.name}
                          {meal.scheduledTime && (
                            <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny font-medium text-text-secondary tabular-nums">
                              {meal.scheduledTime}
                            </span>
                          )}
                        </h3>
                        {meal.items.length > 0 && mKcal > 0 && (
                          <span className="text-caption font-medium tabular-nums text-text-secondary">
                            {mKcal.toFixed(0)} kcal
                          </span>
                        )}
                      </header>
                      {meal.items.length === 0 ? (
                        <p className="text-caption text-text-subtle">
                          Sem alimentos.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {meal.items.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2 text-body"
                            >
                              <div className="min-w-0">
                                <span className="font-medium text-text-primary">
                                  {foodMap.get(it.foodId) ?? "—"}
                                </span>
                                <span className="ml-2 text-caption text-text-muted tabular-nums">
                                  {it.quantityG.toString()}g
                                </span>
                                {it.preparationNotes && (
                                  <span className="ml-1 text-caption text-text-subtle">
                                    ({it.preparationNotes})
                                  </span>
                                )}
                              </div>
                              {it.kcal && Number(it.kcal) > 0 && (
                                <span className="shrink-0 tabular-nums text-caption text-text-muted">
                                  {Number(it.kcal).toFixed(0)} kcal
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
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
    <div className="flex items-center gap-1.5 rounded-md bg-bg-surface px-2 py-1">
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
