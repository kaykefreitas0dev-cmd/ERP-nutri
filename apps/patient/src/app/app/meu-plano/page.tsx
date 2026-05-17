import Link from "next/link";
import { Hospital, Target } from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus planos — NutriCore" };

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
      <h1 className="text-2xl font-bold text-text-primary">Meus planos</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {plans.length} plano(s) recebido(s) ao todo
      </p>

      <div className="mt-6">
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-8 text-center text-text-secondary">
            Nenhum plano alimentar disponível ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/app/meu-plano/${p.id}`}
                  className="block rounded-lg border border-border-subtle bg-white p-4 shadow-sm hover:border-brand-400 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-semibold text-text-primary">
                        {p.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                        <Hospital className="h-3 w-3" strokeWidth={1.75} />
                        {p.patient.organization.name}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-muted">
                        {p.targetKcal && (
                          <>
                            <Target className="h-3 w-3" strokeWidth={1.75} />
                            {Number(p.targetKcal).toFixed(0)} kcal/dia ·{" "}
                          </>
                        )}
                        Atualizado{" "}
                        {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                      </p>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
