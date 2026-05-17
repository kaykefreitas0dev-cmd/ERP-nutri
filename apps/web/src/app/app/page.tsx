import Link from "next/link";
import { redirect } from "next/navigation";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — NutriCore" };

function brMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AppDashboard() {
  let data: {
    org: { name: string; plan: string; subscriptionStatus: string };
    role: string;
    counts: {
      activePatients: number;
      apptsToday: number;
      apptsThisWeek: number;
      mealPlansActive: number;
      docsThisMonth: number;
      paymentsThisMonth: { count: number; totalCents: number };
    };
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx, userId }) => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const dayOfWeek = now.getDay(); // 0=sun
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const membership = await tx.membership.findFirst({
        where: { userId, status: "ACTIVE" },
        include: {
          organization: {
            select: {
              name: true,
              plan: true,
              subscriptionStatus: true,
            },
          },
        },
      });
      if (!membership) throw new ActionTenantError("Sem org", "NO_ORG");

      const [
        activePatients,
        apptsToday,
        apptsThisWeek,
        mealPlansActive,
        docsThisMonth,
        paymentsThisMonth,
      ] = await Promise.all([
        tx.patient.count({ where: { status: "ACTIVE" } }),
        tx.appointment.count({
          where: {
            professionalUserId: userId,
            startsAt: { gte: startOfToday, lte: endOfToday },
            status: { notIn: ["CANCELLED"] },
          },
        }),
        tx.appointment.count({
          where: {
            professionalUserId: userId,
            startsAt: { gte: startOfWeek, lt: endOfWeek },
            status: { notIn: ["CANCELLED"] },
          },
        }),
        tx.mealPlan.count({
          where: { status: { in: ["ACTIVE", "DRAFT"] } },
        }),
        tx.clinicalDocument.count({
          where: {
            issuedByUserId: userId,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
          },
        }),
        tx.patientPayment
          .aggregate({
            where: { paymentDate: { gte: startOfMonth, lt: endOfMonth } },
            _count: true,
            _sum: { amountCents: true },
          })
          .then(
            (r: { _count: number; _sum: { amountCents: number | null } }) => ({
              count: r._count,
              totalCents: r._sum.amountCents ?? 0,
            }),
          ),
      ]);

      return {
        org: membership.organization,
        role: membership.role,
        counts: {
          activePatients,
          apptsToday,
          apptsThisWeek,
          mealPlansActive,
          docsThisMonth,
          paymentsThisMonth,
        },
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!data) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-xs text-slate-500">Organização ativa</p>
          <h1 className="text-2xl font-bold text-slate-900">{data.org.name}</h1>
          <p className="mt-1 text-xs text-slate-600">
            Plano: <span className="font-medium">{data.org.plan}</span> ·
            Status:{" "}
            <span className="font-medium">{data.org.subscriptionStatus}</span> ·
            Role: <span className="font-medium">{data.role}</span>
          </p>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            href="/app/patients"
            label="Pacientes ativos"
            value={data.counts.activePatients.toString()}
            emoji="👥"
          />
          <KpiCard
            href="/app/agenda"
            label="Consultas hoje"
            value={data.counts.apptsToday.toString()}
            emoji="📅"
          />
          <KpiCard
            href="/app/agenda"
            label="Consultas semana"
            value={data.counts.apptsThisWeek.toString()}
            emoji="🗓️"
          />
          <KpiCard
            href="/app/patients"
            label="Planos ativos"
            value={data.counts.mealPlansActive.toString()}
            emoji="🍽️"
          />
          <KpiCard
            href="/app/financeiro"
            label="Receita do mês"
            value={brMoney(data.counts.paymentsThisMonth.totalCents)}
            emoji="💰"
            sub={`${data.counts.paymentsThisMonth.count} pagamento(s)`}
          />
          <KpiCard
            href="/app/patients"
            label="Docs do mês"
            value={data.counts.docsThisMonth.toString()}
            emoji="📄"
          />
        </section>

        {/* Nav cards */}
        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <NavCard
            href="/app/patients"
            title="Pacientes"
            description="Cadastro, anamnese, planos, check-ins, documentos."
            emoji="👥"
          />
          <NavCard
            href="/app/agenda"
            title="Agenda"
            description="Consultas, check-in, conclusão com recibo."
            emoji="📅"
          />
          <NavCard
            href="/app/financeiro"
            title="Financeiro"
            description="Pagamentos registrados, faturamento por mês."
            emoji="💰"
          />
          <NavCard
            href="/app/alimentos"
            title="Alimentos & Receitas"
            description="Biblioteca TACO/POF + receitas próprias."
            emoji="🥗"
          />
          <NavCard
            href="/app/imports"
            title="Importar pacientes"
            description="Migrar de Dietbox, Webdiet ou CSV genérico."
            emoji="📥"
          />
        </section>

        <form action="/api/auth/signout" method="POST" className="mt-8">
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}

function KpiCard({
  href,
  label,
  value,
  emoji,
  sub,
}: {
  href: string;
  label: string;
  value: string;
  emoji: string;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-400 hover:shadow-md"
    >
      <p className="text-xs text-slate-500">
        {emoji} {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </Link>
  );
}

function NavCard({
  href,
  title,
  description,
  emoji,
}: {
  href: string;
  title: string;
  description: string;
  emoji: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-400 hover:shadow-md"
    >
      <div className="text-2xl">{emoji}</div>
      <h3 className="mt-2 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </Link>
  );
}
