import {
  Building2,
  Users,
  FileText,
  Wallet,
  Calendar,
  Activity,
  CircleCheck,
  TrendingUp,
  Repeat,
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

// Rótulos PT-BR para os status de assinatura.
const STATUS_LABEL: Record<string, string> = {
  TRIALING: "Em teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Inadimplente",
  SUSPENDED: "Suspensa",
  CANCELED: "Cancelada",
};

export default async function AdminDashboard() {
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
    plans,
    orgGroups,
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
    prisma.pricingPlan.findMany({
      select: { slug: true, name: true, priceMonthlyCents: true },
    }),
    prisma.organization.groupBy({
      by: ["plan", "subscriptionStatus"],
      _count: { _all: true },
    }),
  ]);

  // ── MRR: soma do preço mensal das organizações com assinatura ATIVA ──────
  const planMap = new Map(plans.map((p) => [p.slug, p]));
  let mrrCents = 0;
  let activeSubs = 0;
  const statusCounts: Record<string, number> = {};
  const byPlan = new Map<
    string,
    { name: string; active: number; mrrCents: number }
  >();

  for (const g of orgGroups) {
    const count = g._count._all;
    statusCounts[g.subscriptionStatus] =
      (statusCounts[g.subscriptionStatus] ?? 0) + count;
    if (g.subscriptionStatus === "ACTIVE") {
      const plan = planMap.get(g.plan);
      const priceCents = plan?.priceMonthlyCents ?? 0;
      mrrCents += priceCents * count;
      activeSubs += count;
      const entry = byPlan.get(g.plan) ?? {
        name: plan?.name ?? g.plan,
        active: 0,
        mrrCents: 0,
      };
      entry.active += count;
      entry.mrrCents += priceCents * count;
      byPlan.set(g.plan, entry);
    }
  }
  const arrCents = mrrCents * 12;
  const arpaCents = activeSubs > 0 ? Math.round(mrrCents / activeSubs) : 0;
  const planRows = Array.from(byPlan.values()).sort(
    (a, b) => b.mrrCents - a.mrrCents,
  );
  const statusOrder = [
    "ACTIVE",
    "TRIALING",
    "PAST_DUE",
    "SUSPENDED",
    "CANCELED",
  ];

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

      {/* ── Receita recorrente (MRR) ─────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Repeat className="h-4 w-4" strokeWidth={1.75} />
          Receita recorrente (assinaturas SaaS)
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="MRR"
            value={brMoney(mrrCents)}
            sub="assinaturas ativas"
            Icon={TrendingUp}
            accent
          />
          <KpiCard
            label="ARR"
            value={brMoney(arrCents)}
            sub="MRR × 12"
            Icon={TrendingUp}
          />
          <KpiCard
            label="Assinaturas ativas"
            value={activeSubs.toString()}
            sub={`${totalOrgs} orgs no total`}
            Icon={Repeat}
          />
          <KpiCard
            label="Receita média (ARPA)"
            value={brMoney(arpaCents)}
            sub="por org ativa"
            Icon={Wallet}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Por plano */}
          <div className="rounded-lg border border-border-subtle bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">
              MRR por plano
            </h3>
            {planRows.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                Nenhuma assinatura ativa ainda — MRR aparecerá quando orgs
                saírem do teste e passarem a pagar.
              </p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                    <th className="pb-2 font-medium">Plano</th>
                    <th className="pb-2 text-right font-medium">Ativas</th>
                    <th className="pb-2 text-right font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((r) => (
                    <tr
                      key={r.name}
                      className="border-t border-border-subtle text-text-primary"
                    >
                      <td className="py-1.5">{r.name}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.active}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {brMoney(r.mrrCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Por status */}
          <div className="rounded-lg border border-border-subtle bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">
              Organizações por status de assinatura
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {statusOrder
                .filter((s) => statusCounts[s])
                .map((s) => (
                  <li
                    key={s}
                    className="flex items-center justify-between text-text-primary"
                  >
                    <span>{STATUS_LABEL[s] ?? s}</span>
                    <span className="tabular-nums font-medium">
                      {statusCounts[s]}
                    </span>
                  </li>
                ))}
              {Object.keys(statusCounts).length === 0 && (
                <li className="text-text-muted">Sem organizações.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Atividade clínica ────────────────────────────────────────────── */}
      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="GMV pacientes (mês)"
          value={brMoney(paymentsThisMonth._sum.amountCents ?? 0)}
          sub={`${paymentsThisMonth._count} pagamento(s) registrados`}
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
            MRR considera o preço mensal do plano das organizações com
            assinatura ativa. Com a cobrança intermediada (Asaas) ativa,
            refletirá a receita real cobrada.
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
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-4 shadow-sm " +
        (accent
          ? "border-emerald-200 bg-emerald-50"
          : "border-border-subtle bg-white")
      }
    >
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted">{sub}</p>
    </div>
  );
}
