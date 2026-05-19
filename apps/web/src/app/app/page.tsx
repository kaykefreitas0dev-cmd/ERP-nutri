import { redirect } from "next/navigation";
import {
  Users,
  Calendar,
  CalendarDays,
  Utensils,
  Wallet,
  FileText,
  Salad,
  Download,
  Settings,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { MetricCard, NavCard } from "@/components/dashboard/MetricCard";
import { WelcomeTour } from "./WelcomeTour";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — NutriCore" };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
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

  const totalAppts =
    data.counts.apptsToday +
    (data.counts.apptsThisWeek - data.counts.apptsToday);

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        {/* Hero header — saudação contextual + org info */}
        <header className="mb-6">
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            {greeting()}
          </p>
          <h1 className="mt-1 text-display font-semibold tracking-tight text-text-primary">
            {data.org.name}
          </h1>
          <p className="mt-2 text-caption text-text-secondary">
            Você tem{" "}
            <span className="font-medium text-text-primary tabular-nums">
              {data.counts.apptsToday}
            </span>{" "}
            consulta{data.counts.apptsToday !== 1 ? "s" : ""} hoje
            {data.counts.mealPlansActive > 0 && (
              <>
                {" "}
                e{" "}
                <span className="font-medium text-text-primary tabular-nums">
                  {data.counts.mealPlansActive}
                </span>{" "}
                plano{data.counts.mealPlansActive !== 1 ? "s ativos" : " ativo"}
              </>
            )}
            .
          </p>
        </header>

        <WelcomeTour />

        {/* KPIs — MetricCards animados */}
        <section
          aria-label="Métricas principais"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
        >
          <MetricCard
            label="Pacientes ativos"
            value={data.counts.activePatients}
            icon={<Users strokeWidth={1.75} />}
            href="/app/patients"
            sub={data.counts.activePatients === 1 ? "1 ativo" : "total ativos"}
          />
          <MetricCard
            label="Consultas hoje"
            value={data.counts.apptsToday}
            icon={<Calendar strokeWidth={1.75} />}
            href="/app/agenda"
            sub="agendadas hoje"
          />
          <MetricCard
            label="Consultas semana"
            value={data.counts.apptsThisWeek}
            icon={<CalendarDays strokeWidth={1.75} />}
            href="/app/agenda"
            sub={`${totalAppts >= data.counts.apptsThisWeek ? "" : "+ extras"}`}
          />
          <MetricCard
            label="Planos ativos"
            value={data.counts.mealPlansActive}
            icon={<Utensils strokeWidth={1.75} />}
            href="/app/patients"
            sub="em andamento"
          />
          <MetricCard
            label="Receita do mês"
            prefix="R$"
            value={data.counts.paymentsThisMonth.totalCents / 100}
            decimals={2}
            icon={<Wallet strokeWidth={1.75} />}
            href="/app/financeiro"
            sub={`${data.counts.paymentsThisMonth.count} pagamento${data.counts.paymentsThisMonth.count !== 1 ? "s" : ""}`}
          />
          <MetricCard
            label="Docs do mês"
            value={data.counts.docsThisMonth}
            icon={<FileText strokeWidth={1.75} />}
            href="/app/patients"
            sub="emitidos no mês"
          />
        </section>

        {/* Nav cards — seções principais */}
        <section aria-label="Atalhos" className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-h2 font-semibold text-text-primary">Atalhos</h2>
            <p className="text-caption text-text-muted">
              Pressione{" "}
              <kbd className="rounded border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono text-tiny font-medium text-text-secondary">
                ⌘K
              </kbd>{" "}
              para busca rápida
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <NavCard
              href="/app/patients"
              title="Pacientes"
              description="Cadastro, anamnese, planos, check-ins, documentos."
              icon={<Users strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/agenda"
              title="Agenda"
              description="Consultas, check-in, conclusão com recibo."
              icon={<Calendar strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/financeiro"
              title="Financeiro"
              description="Pagamentos registrados, faturamento por mês."
              icon={<Wallet strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/alimentos"
              title="Alimentos & Receitas"
              description="Biblioteca TACO/POF + receitas próprias."
              icon={<Salad strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/imports"
              title="Importar pacientes"
              description="Migrar de Dietbox, Webdiet ou CSV genérico."
              icon={<Download strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/settings"
              title="Configurações"
              description="Branding, nome no email, dados da org."
              icon={<Settings strokeWidth={1.75} />}
            />
          </div>
        </section>

        {/* Status meta — plano + role (footer sutil) */}
        <p className="mt-10 text-tiny text-text-muted">
          Plano:{" "}
          <span className="font-medium text-text-secondary">
            {data.org.plan}
          </span>{" "}
          · Status:{" "}
          <span className="font-medium text-text-secondary">
            {data.org.subscriptionStatus}
          </span>{" "}
          · Sua role:{" "}
          <span className="font-medium text-text-secondary">{data.role}</span>
        </p>
      </div>
    </main>
  );
}
