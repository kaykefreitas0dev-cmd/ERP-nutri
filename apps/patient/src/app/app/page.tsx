import Link from "next/link";
import { CircleCheck, Flame, Hospital, Utensils, FileText } from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Início — NutriCore" };

function todayLocalISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PatientHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout já garante auth; aqui apenas leitura

  // Streak + check-in de hoje
  const todayDate = new Date(todayLocalISO() + "T12:00:00Z");
  const [streak, todayCheckin] = await Promise.all([
    prisma.userHealthStreak.findUnique({ where: { userId: user!.id } }),
    prisma.userHealthCheckin.findUnique({
      where: {
        userId_checkinDate: { userId: user!.id, checkinDate: todayDate },
      },
      select: { id: true },
    }),
  ]);

  // Lock 6 — Patient é User-scoped: encontre todos os Patient records vinculados a este user
  const patients = await prisma.patient.findMany({
    where: { userId: user!.id, status: { not: "ANONYMIZED" } },
    select: {
      id: true,
      fullName: true,
      preferredName: true,
      organization: { select: { id: true, name: true } },
      mealPlans: {
        where: { status: { in: ["ACTIVE", "DRAFT"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          status: true,
          targetKcal: true,
          updatedAt: true,
        },
      },
      clinicalDocuments: {
        where: { status: "ISSUED" },
        orderBy: { issuedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          documentType: true,
          issuedAt: true,
        },
      },
    },
  });

  const isFirstTime = welcome === "1";

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      {isFirstTime && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          <p className="flex items-center gap-2 font-semibold">
            <CircleCheck className="h-4 w-4" strokeWidth={2} />
            Boas-vindas à NutriCore!
          </p>
          <p className="mt-1 text-xs">
            Seu acesso está pronto. Explore seu plano alimentar e fique de olho
            nos documentos enviados pela(o) sua(eu) nutricionista.
          </p>
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-900">
        Olá
        {patients[0]?.preferredName ? `, ${patients[0].preferredName}` : ""}!
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Aqui está o resumo do seu acompanhamento nutricional.
      </p>

      {/* CTA check-in */}
      <div
        className={`mt-4 rounded-lg border p-4 ${
          todayCheckin
            ? "border-green-200 bg-green-50"
            : "border-teal-300 bg-teal-50"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              {todayCheckin && (
                <CircleCheck
                  className="h-4 w-4 text-green-600"
                  strokeWidth={2}
                />
              )}
              {todayCheckin ? "Check-in de hoje feito" : "Como foi seu dia?"}
            </p>
            {streak && streak.currentStreak > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-orange-700">
                <Flame className="h-3.5 w-3.5" strokeWidth={2} />
                {streak.currentStreak} dia(s) seguidos
                {streak.longestStreak > streak.currentStreak &&
                  ` (recorde ${streak.longestStreak})`}
              </p>
            )}
          </div>
          <Link
            href="/app/checkin"
            className="shrink-0 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {todayCheckin ? "Editar" : "Fazer check-in"}
          </Link>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">
            Você ainda não está vinculado a nenhum profissional.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Peça à sua(seu) nutricionista um link de convite para conectar sua
            conta.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {patients.map((p) => (
            <section
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <header className="border-b border-slate-100 pb-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Hospital
                    className="h-5 w-5 text-teal-600"
                    strokeWidth={1.75}
                  />
                  {p.organization.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Registrado como: {p.fullName}
                </p>
              </header>

              {/* Planos */}
              <div className="mt-3">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Utensils className="h-4 w-4" strokeWidth={1.75} />
                  Planos alimentares ({p.mealPlans.length})
                </h3>
                {p.mealPlans.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Nenhum plano ativo ainda.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {p.mealPlans.map((mp) => (
                      <li key={mp.id}>
                        <Link
                          href={`/app/meu-plano/${mp.id}`}
                          className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-teal-400 hover:bg-teal-50"
                        >
                          <div>
                            <p className="font-medium text-slate-800">
                              {mp.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {mp.targetKcal &&
                                `${Number(mp.targetKcal).toFixed(0)} kcal/dia · `}
                              Atualizado{" "}
                              {new Date(mp.updatedAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              mp.status === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {mp.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Documentos */}
              {p.clinicalDocuments.length > 0 && (
                <div className="mt-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <FileText className="h-4 w-4" strokeWidth={1.75} />
                    Últimos documentos
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {p.clinicalDocuments.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800">
                            {d.title}
                          </p>
                          {d.issuedAt && (
                            <p className="text-xs text-slate-500">
                              {new Date(d.issuedAt).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/app/documentos/${d.id}`}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Ver
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
