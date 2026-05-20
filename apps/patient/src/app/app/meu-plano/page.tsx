import Link from "next/link";
import { Hospital, Target, Utensils } from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus planos — NutriCore" };

const PLAN_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  DRAFT: "Rascunho",
  ARCHIVED: "Arquivado",
};

export default async function MyPlansPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const plans = await prisma.mealPlan.findMany({
    where: {
      patient: { userId: user!.id, status: { not: "ANONYMIZED" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      status: true,
      targetKcal: true,
      startDate: true,
      endDate: true,
      updatedAt: true,
      patient: {
        select: {
          fullName: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
        Sua alimentação
      </p>
      <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
        Meus planos
      </h1>
      <p className="mt-1 text-caption text-text-secondary tabular-nums">
        {plans.length} plano{plans.length === 1 ? "" : "s"} recebido
        {plans.length === 1 ? "" : "s"} ao todo
      </p>

      <div className="mt-6">
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
              <Utensils className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-h3 font-semibold text-text-primary">
              Sem planos ainda
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              Quando sua(seu) nutricionista criar um plano alimentar pra você,
              ele aparecerá aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/app/meu-plano/${p.id}`}
                  className="group block rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)] transition-all duration-fast hover:border-brand-primary hover:[box-shadow:var(--shadow-sm)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary">
                        <Utensils className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-text-primary group-hover:text-brand-primary">
                          {p.name}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-caption text-text-secondary">
                          <Hospital className="h-3 w-3" strokeWidth={1.75} />
                          {p.patient.organization.name}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-tiny text-text-muted">
                          {p.targetKcal && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Target className="h-3 w-3" strokeWidth={1.75} />
                              {Number(p.targetKcal).toFixed(0)} kcal/dia
                            </span>
                          )}
                          <span className="tabular-nums">
                            · Atualizado{" "}
                            {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </p>
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
                      {PLAN_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
