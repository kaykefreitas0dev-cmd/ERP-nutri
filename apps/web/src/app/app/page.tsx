import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@nutricore/db";

export const dynamic = "force-dynamic";

export default async function AppDashboard() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Se não tem nenhuma org, vai para onboarding
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      organization: {
        select: { name: true, slug: true, plan: true, subscriptionStatus: true },
      },
    },
  });

  if (!membership) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-sm text-slate-500">Organização ativa</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {membership.organization.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Plano: <span className="font-medium">{membership.organization.plan}</span>{" "}
            • Status:{" "}
            <span className="font-medium">{membership.organization.subscriptionStatus}</span>{" "}
            • Role: <span className="font-medium">{membership.role}</span>
          </p>
        </header>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            🎉 Conta criada com sucesso!
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            As funcionalidades de gestão (pacientes, agenda, planos alimentares) chegam
            nas próximas sprints. Você ainda pode:
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              ✓ Configurar branding da organização (logo, cores) — em breve
            </li>
            <li>✓ Convidar membros da equipe — em breve</li>
            <li>
              ✓ Ver{" "}
              <a href="/api/v1/me" className="text-teal-700 underline">
                seu perfil em JSON
              </a>
            </li>
          </ul>

          <form action="/api/auth/signout" method="POST" className="mt-6">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
