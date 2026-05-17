import Link from "next/link";
import { notFound } from "next/navigation";
import { Hospital, Calendar, Utensils } from "lucide-react";
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

  // Buscar nomes dos foods (via snapshot foodId, mas usando version do snapshot)
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

  let totalKcal = 0;
  let totalP = 0;
  let totalC = 0;
  let totalF = 0;
  for (const d of plan.days) {
    for (const m of d.meals) {
      for (const i of m.items) {
        if (i.kcal) totalKcal += Number(i.kcal);
        if (i.proteinG) totalP += Number(i.proteinG);
        if (i.carbG) totalC += Number(i.carbG);
        if (i.fatG) totalF += Number(i.fatG);
      }
    }
  }
  const target = plan.targetKcal ? Number(plan.targetKcal) : null;
  const pct = target ? Math.round((totalKcal / target) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <Link
        href="/app/meu-plano"
        className="text-sm text-brand-primary hover:underline"
      >
        ← Meus planos
      </Link>

      <header className="mt-2">
        <h1 className="text-2xl font-bold text-text-primary">{plan.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
          <Hospital className="h-4 w-4 text-brand-primary" strokeWidth={1.75} />
          {plan.patient.organization.name}
        </p>
      </header>

      <div className="mt-4 rounded-lg border border-brand-200 bg-brand-primary-bg p-4">
        <p className="text-2xl font-bold text-brand-primary">
          {totalKcal.toFixed(0)} kcal/dia
        </p>
        {target && (
          <p className="text-xs text-brand-primary">
            Meta: {target.toFixed(0)} kcal ({pct}%)
          </p>
        )}
        <p className="mt-2 text-xs text-brand-primary-hover">
          PTN <strong>{totalP.toFixed(0)}g</strong> · CHO{" "}
          <strong>{totalC.toFixed(0)}g</strong> · LIP{" "}
          <strong>{totalF.toFixed(0)}g</strong>
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {plan.days.map((day) => (
          <section
            key={day.id}
            className="rounded-lg border border-border-subtle bg-white shadow-sm"
          >
            <header className="border-b border-border-subtle bg-bg-subtle px-4 py-2">
              <h2 className="flex items-center gap-1.5 text-base font-semibold text-text-primary">
                <Calendar className="h-4 w-4" strokeWidth={1.75} />
                {day.dayLabel}
              </h2>
            </header>

            <div className="divide-y divide-border-subtle">
              {day.meals.map((meal) => {
                let mKcal = 0;
                for (const it of meal.items)
                  if (it.kcal) mKcal += Number(it.kcal);
                return (
                  <div key={meal.id} className="px-4 py-3">
                    <header className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 font-medium text-text-primary">
                        <Utensils
                          className="h-3.5 w-3.5 text-brand-primary"
                          strokeWidth={1.75}
                        />
                        {meal.name}
                        {meal.scheduledTime && (
                          <span className="ml-2 text-xs font-normal text-text-muted">
                            {meal.scheduledTime}
                          </span>
                        )}
                      </h3>
                      {meal.items.length > 0 && (
                        <span className="text-xs tabular-nums text-text-secondary">
                          {mKcal.toFixed(0)} kcal
                        </span>
                      )}
                    </header>
                    {meal.items.length === 0 ? (
                      <p className="mt-1 text-xs text-text-subtle">
                        Sem alimentos.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm">
                        {meal.items.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-center justify-between rounded-md bg-bg-subtle px-3 py-1.5"
                          >
                            <span>
                              {foodMap.get(it.foodId) ?? "—"}
                              <span className="ml-2 text-xs text-text-muted">
                                {it.quantityG.toString()}g
                              </span>
                              {it.preparationNotes && (
                                <span className="ml-1 text-xs text-text-subtle">
                                  ({it.preparationNotes})
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
