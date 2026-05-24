import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Users,
  TrendingUp,
  Flame,
  CalendarCheck2,
  ClipboardList,
  Wallet,
  ArrowRight,
  CircleCheck,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatórios" };

function ptBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default async function RelatoriosPage() {
  const now = new Date();

  // ── Janelas de tempo ──────────────────────────────────────────────────────
  const start30d = new Date(now.getTime() - 30 * 24 * 3_600_000);
  start30d.setHours(0, 0, 0, 0);

  // 3 últimos meses completos para tabela de receita
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 2; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(
      now.getFullYear(),
      now.getMonth() - i + 1,
      0,
      23,
      59,
      59,
      999,
    );
    months.push({ label: monthLabel(s), start: s, end: e });
  }

  type ReportData = {
    // Engajamento
    engagement: {
      totalCheckins30d: number;
      activePatients: number;
      avgCheckinsPerActivePatient: number;
      followedPlanRate: number; // % nos últimos 30d
      topPatients: Array<{
        id: string;
        fullName: string;
        checkinCount: number;
        streak: number;
      }>;
    };
    // Produção clínica
    clinical: {
      apptCompleted30d: number;
      apptNoShow30d: number;
      plansCreated30d: number;
      docsGenerated30d: number;
    };
    // Financeiro por método (30d)
    paymentMethods: Array<{
      method: string | null;
      count: number;
      totalCents: number;
    }>;
    // Receita mensal (últimos 3 meses)
    monthlyRevenue: Array<{
      label: string;
      totalCents: number;
      count: number;
      apptCount: number;
    }>;
  };

  let report: ReportData | null = null;

  try {
    report = await withTenantAction(async ({ tx }) => {
      // ── Pacientes ativos ────────────────────────────────────────────────
      const activePatients = await tx.patient.count({
        where: { status: "ACTIVE" },
      });

      // ── Check-ins últimos 30d ───────────────────────────────────────────
      // Obtemos os userId de todos os pacientes ativos com userId
      const linkedPatients = (await tx.patient.findMany({
        where: { status: "ACTIVE", userId: { not: null } },
        select: { id: true, fullName: true, userId: true },
        take: 500,
      })) as Array<{ id: string; fullName: string; userId: string }>;

      const userIds = linkedPatients.map((p) => p.userId);

      const [checkinsAgg, followedAgg] =
        userIds.length > 0
          ? await Promise.all([
              tx.userHealthCheckin.aggregate({
                where: {
                  userId: { in: userIds },
                  checkinDate: { gte: start30d },
                },
                _count: true,
              }),
              tx.userHealthCheckin.aggregate({
                where: {
                  userId: { in: userIds },
                  checkinDate: { gte: start30d },
                  followedPlan: { not: null },
                },
                _count: true,
              }),
            ])
          : [{ _count: 0 }, { _count: 0 }];

      const followedYes =
        userIds.length > 0
          ? await tx.userHealthCheckin.count({
              where: {
                userId: { in: userIds },
                checkinDate: { gte: start30d },
                followedPlan: true,
              },
            })
          : 0;

      const totalCheckins30d = (checkinsAgg._count as number) ?? 0;
      const totalWithPlan = (followedAgg._count as number) ?? 0;
      const followedPlanRate =
        totalWithPlan > 0 ? Math.round((followedYes / totalWithPlan) * 100) : 0;

      const avgCheckinsPerActivePatient =
        activePatients > 0
          ? Math.round((totalCheckins30d / activePatients) * 10) / 10
          : 0;

      // ── Top 5 pacientes por check-ins (30d) ─────────────────────────────
      // Buscar streaks para rankear por engajamento
      const streaks =
        userIds.length > 0
          ? ((await tx.userHealthStreak.findMany({
              where: { userId: { in: userIds } },
              orderBy: { currentStreak: "desc" },
              take: 5,
              select: {
                userId: true,
                currentStreak: true,
                totalCheckins: true,
              },
            })) as Array<{
              userId: string;
              currentStreak: number;
              totalCheckins: number;
            }>)
          : [];

      const topPatients = streaks.map((s) => {
        const patient = linkedPatients.find((p) => p.userId === s.userId);
        return {
          id: patient?.id ?? "",
          fullName: patient?.fullName ?? "—",
          checkinCount: s.totalCheckins,
          streak: s.currentStreak,
        };
      });

      // ── Produção clínica (30d) ──────────────────────────────────────────
      const [
        apptCompleted30d,
        apptNoShow30d,
        plansCreated30d,
        docsGenerated30d,
      ] = await Promise.all([
        tx.appointment.count({
          where: { status: "COMPLETED", completedAt: { gte: start30d } },
        }),
        tx.appointment.count({
          where: { status: "NO_SHOW", startsAt: { gte: start30d } },
        }),
        tx.mealPlan.count({
          where: { createdAt: { gte: start30d } },
        }),
        tx.clinicalDocument.count({
          where: { createdAt: { gte: start30d } },
        }),
      ]);

      // ── Pagamentos por método (30d) ─────────────────────────────────────
      const rawPayments = (await tx.patientPayment.groupBy({
        by: ["externalPaymentMethod"],
        where: {
          paymentDate: { gte: start30d },
          status: { in: ["PAID", "EXTERNAL_RECORDED"] },
        },
        _count: true,
        _sum: { amountCents: true },
        orderBy: { _sum: { amountCents: "desc" } },
      })) as Array<{
        externalPaymentMethod: string | null;
        _count: number;
        _sum: { amountCents: number | null };
      }>;

      const paymentMethods = rawPayments.map((r) => ({
        method: r.externalPaymentMethod,
        count: r._count,
        totalCents: r._sum.amountCents ?? 0,
      }));

      // ── Receita mensal (últimos 3 meses) ────────────────────────────────
      const monthlyRevenue = await Promise.all(
        months.map(async (m) => {
          const [payAgg, apptCount] = await Promise.all([
            tx.patientPayment.aggregate({
              where: {
                paymentDate: { gte: m.start, lte: m.end },
                status: { in: ["PAID", "EXTERNAL_RECORDED"] },
              },
              _count: true,
              _sum: { amountCents: true },
            }),
            tx.appointment.count({
              where: {
                status: "COMPLETED",
                completedAt: { gte: m.start, lte: m.end },
              },
            }),
          ]);
          return {
            label: m.label,
            totalCents: (payAgg._sum.amountCents as number | null) ?? 0,
            count: (payAgg._count as number) ?? 0,
            apptCount,
          };
        }),
      );

      return {
        engagement: {
          totalCheckins30d,
          activePatients,
          avgCheckinsPerActivePatient,
          followedPlanRate,
          topPatients,
        },
        clinical: {
          apptCompleted30d,
          apptNoShow30d,
          plansCreated30d,
          docsGenerated30d,
        },
        paymentMethods,
        monthlyRevenue,
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!report) redirect("/app");

  const { engagement, clinical, paymentMethods, monthlyRevenue } = report;

  const METHOD_LABEL: Record<string, string> = {
    PIX: "PIX",
    CARD_EXTERNAL: "Cartão",
    CASH: "Dinheiro",
    BANK_TRANSFER: "Transferência",
    OTHER: "Outro",
  };

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-h1 font-bold text-text-primary">Relatórios</h1>
          <p className="mt-1 text-body text-text-muted">
            Resumo dos últimos 30 dias e tendências mensais da sua prática.
          </p>
        </div>

        {/* ── Engajamento dos pacientes ────────────────────────────────── */}
        <section>
          <SectionTitle
            icon={<Flame className="h-4 w-4 text-warning" strokeWidth={1.75} />}
            title="Engajamento dos pacientes"
            subtitle="Check-ins e aderência ao plano nos últimos 30 dias"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Pacientes ativos"
              value={engagement.activePatients}
              icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
            />
            <KpiCard
              label="Check-ins (30d)"
              value={engagement.totalCheckins30d}
              icon={
                <Flame className="h-4 w-4 text-warning" strokeWidth={1.75} />
              }
            />
            <KpiCard
              label="Média por paciente"
              value={engagement.avgCheckinsPerActivePatient}
              icon={
                <TrendingUp
                  className="h-4 w-4 text-success"
                  strokeWidth={1.75}
                />
              }
              sub="check-ins / paciente"
            />
            <KpiCard
              label="Taxa de aderência"
              value={
                engagement.totalCheckins30d > 0
                  ? `${engagement.followedPlanRate}%`
                  : "—"
              }
              icon={
                <CircleCheck
                  className="h-4 w-4 text-success"
                  strokeWidth={1.75}
                />
              }
              sub="seguiram o plano"
            />
          </div>

          {/* Top pacientes */}
          {engagement.topPatients.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
              <div className="border-b border-border-subtle px-4 py-3">
                <p className="text-body font-semibold text-text-primary">
                  Pacientes mais engajados
                </p>
              </div>
              <ul className="divide-y divide-border-subtle">
                {engagement.topPatients.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="w-5 text-center text-tiny font-bold text-text-muted tabular-nums">
                      {i + 1}
                    </span>
                    <Link
                      href={`/app/patients/${p.id}/checkins`}
                      className="flex-1 text-body font-medium text-text-primary hover:underline underline-offset-2"
                    >
                      {p.fullName}
                    </Link>
                    <span className="flex items-center gap-1 text-tiny text-warning">
                      <Flame className="h-3 w-3" strokeWidth={2} />
                      {p.streak}d streak
                    </span>
                    <span className="text-tiny text-text-muted">
                      {p.checkinCount} total
                    </span>
                    <Link
                      href={`/app/patients/${p.id}/checkins`}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── Produção clínica ─────────────────────────────────────────── */}
        <section>
          <SectionTitle
            icon={
              <ClipboardList
                className="h-4 w-4 text-brand-primary"
                strokeWidth={1.75}
              />
            }
            title="Produção clínica (últimos 30 dias)"
            subtitle="Consultas, planos e documentos gerados"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Consultas realizadas"
              value={clinical.apptCompleted30d}
              icon={
                <CalendarCheck2
                  className="h-4 w-4 text-success"
                  strokeWidth={1.75}
                />
              }
            />
            <KpiCard
              label="Faltas"
              value={clinical.apptNoShow30d}
              icon={
                <CalendarCheck2
                  className="h-4 w-4 text-warning"
                  strokeWidth={1.75}
                />
              }
            />
            <KpiCard
              label="Planos criados"
              value={clinical.plansCreated30d}
              icon={
                <BarChart3
                  className="h-4 w-4 text-brand-primary"
                  strokeWidth={1.75}
                />
              }
            />
            <KpiCard
              label="Documentos emitidos"
              value={clinical.docsGenerated30d}
              icon={
                <ClipboardList
                  className="h-4 w-4 text-text-secondary"
                  strokeWidth={1.75}
                />
              }
            />
          </div>
          <div className="mt-2 flex justify-end">
            <Link
              href="/app/agenda"
              className="text-tiny text-text-link hover:underline underline-offset-2"
            >
              Ver agenda completa →
            </Link>
          </div>
        </section>

        {/* ── Receita mensal ───────────────────────────────────────────── */}
        <section>
          <SectionTitle
            icon={
              <Wallet className="h-4 w-4 text-success" strokeWidth={1.75} />
            }
            title="Receita mensal"
            subtitle="Últimos 3 meses — pagamentos registrados na plataforma"
          />
          <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
            <table className="w-full text-body">
              <thead className="border-b border-border-subtle bg-bg-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Mês
                  </th>
                  <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Consultas realizadas
                  </th>
                  <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Pagamentos registrados
                  </th>
                  <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Receita total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {monthlyRevenue.map((m, i) => {
                  const isCurrentMonth = i === monthlyRevenue.length - 1;
                  return (
                    <tr
                      key={m.label}
                      className={isCurrentMonth ? "bg-brand-primary-bg/30" : ""}
                    >
                      <td className="px-4 py-3 font-medium capitalize text-text-primary">
                        {m.label}
                        {isCurrentMonth && (
                          <span className="ml-1.5 text-tiny text-brand-primary">
                            (atual)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                        {m.apptCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                        {m.count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-primary">
                        {m.totalCents > 0 ? ptBRL(m.totalCents) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex justify-end">
            <Link
              href="/app/financeiro"
              className="text-tiny text-text-link hover:underline underline-offset-2"
            >
              Ver financeiro completo →
            </Link>
          </div>
        </section>

        {/* ── Pagamentos por método (30d) ──────────────────────────────── */}
        {paymentMethods.length > 0 && (
          <section>
            <SectionTitle
              icon={
                <Wallet
                  className="h-4 w-4 text-text-secondary"
                  strokeWidth={1.75}
                />
              }
              title="Métodos de pagamento (30 dias)"
              subtitle="Distribuição dos recebimentos registrados"
            />
            <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
              <table className="w-full text-body">
                <thead className="border-b border-border-subtle bg-bg-subtle">
                  <tr>
                    <th className="px-4 py-3 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      Método
                    </th>
                    <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      Qtd.
                    </th>
                    <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {(() => {
                    const grandTotal = paymentMethods.reduce(
                      (sum, m) => sum + m.totalCents,
                      0,
                    );
                    return paymentMethods.map((m) => (
                      <tr
                        key={m.method ?? "null"}
                        className="hover:bg-bg-subtle"
                      >
                        <td className="px-4 py-2.5 font-medium text-text-primary">
                          {m.method
                            ? (METHOD_LABEL[m.method] ?? m.method)
                            : "Não especificado"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                          {m.count}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">
                          {ptBRL(m.totalCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">
                          {grandTotal > 0
                            ? `${Math.round((m.totalCents / grandTotal) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
        <p className="text-tiny text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <div className="flex items-center justify-between">
        <p className="text-tiny text-text-muted">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-h2 font-bold tabular-nums text-text-primary">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-tiny text-text-muted">{sub}</p>}
    </div>
  );
}
