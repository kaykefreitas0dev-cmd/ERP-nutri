import {
  Building2,
  Users,
  FileText,
  Wallet,
  Calendar,
  Activity,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Dashboard" };

function brMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminDashboard() {
  // Admin queries — direto via prisma (sem RLS por causa de service-role
  // bypassa, mas aqui usamos auth.is_super_admin() RLS policy implicit)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrgs,
    totalUsers,
    totalPatients,
    totalAppointments,
    totalDocuments,
    paymentsThisMonth,
    orgsCreatedThisMonth,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.patient.count({ where: { status: { not: "ANONYMIZED" } } }),
    prisma.appointment.count(),
    prisma.clinicalDocument.count({ where: { status: "ISSUED" } }),
    prisma.patientPayment.aggregate({
      where: { paymentDate: { gte: startOfMonth } },
      _count: true,
      _sum: { amountCents: true },
    }),
    prisma.organization.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Dashboard global
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Visão consolidada de toda a plataforma NutriCore.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Organizações"
          value={totalOrgs.toString()}
          sub={`${orgsCreatedThisMonth} criadas este mês`}
          Icon={Building2}
        />
        <KpiCard
          label="Usuários (global)"
          value={totalUsers.toString()}
          sub="auth.users"
          Icon={Users}
        />
        <KpiCard
          label="Pacientes ativos"
          value={totalPatients.toString()}
          sub="todas orgs"
          Icon={Users}
        />
        <KpiCard
          label="Consultas total"
          value={totalAppointments.toString()}
          sub="lifetime"
          Icon={Calendar}
        />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Receita mensal (GMV)"
          value={brMoney(paymentsThisMonth._sum.amountCents ?? 0)}
          sub={`${paymentsThisMonth._count} pagamento(s)`}
          Icon={Wallet}
        />
        <KpiCard
          label="Documentos emitidos"
          value={totalDocuments.toString()}
          sub="ISSUED lifetime"
          Icon={FileText}
        />
      </section>

      <section className="mt-8 rounded-lg border border-border-subtle bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <Activity className="h-4 w-4" strokeWidth={1.75} />
          Health check
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <CircleCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
              strokeWidth={1.75}
            />
            DB conectado · {totalOrgs} orgs · {totalUsers} users
          </li>
          <li className="flex items-start gap-2">
            <CircleCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
              strokeWidth={1.75}
            />
            Audit log ativo (use o menu &ldquo;Audit log&rdquo; para inspecionar
            eventos)
          </li>
          <li className="text-text-muted">
            Funcionalidades adicionais (suspender org, MFA admin, métricas
            detalhadas) ainda virão em sprints futuras.
          </li>
        </ul>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted">{sub}</p>
    </div>
  );
}
