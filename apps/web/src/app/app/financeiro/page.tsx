import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Smartphone,
  CreditCard,
  Banknote,
  Landmark,
  HelpCircle,
  BarChart3,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro — NutriCore" };

const METHOD_LABEL: Record<string, { label: string; Icon: LucideIcon }> = {
  PIX: { label: "PIX", Icon: Smartphone },
  CARD_EXTERNAL: { label: "Cartão", Icon: CreditCard },
  CASH: { label: "Dinheiro", Icon: Banknote },
  BANK_TRANSFER: { label: "Transferência", Icon: Landmark },
  OTHER: { label: "Outro", Icon: HelpCircle },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  EXTERNAL_RECORDED: {
    label: "Registrado (externo)",
    color: "bg-slate-100 text-slate-700",
  },
  PENDING: { label: "Pendente", color: "bg-amber-100 text-amber-800" },
  PAID: { label: "Pago", color: "bg-green-100 text-green-800" },
  REFUNDED: { label: "Estornado", color: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelado", color: "bg-slate-200 text-slate-600" },
};

function brMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  searchParams: Promise<{
    from?: string;
    to?: string;
    method?: string;
    q?: string;
  }>;
}

export default async function FinanceiroPage({ searchParams }: Props) {
  const { from, to, method, q } = await searchParams;

  // Default: mês corrente
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0); // último dia do mês

  const fromDate = from ? new Date(from + "T00:00:00Z") : defaultFrom;
  const toDate = to
    ? new Date(to + "T23:59:59Z")
    : new Date(defaultTo.setHours(23, 59, 59, 999));

  let data: {
    payments: Array<{
      id: string;
      paymentDate: Date;
      amountCents: number;
      currency: string;
      status: string;
      externalPaymentMethod: string | null;
      externalReference: string | null;
      description: string | null;
      receiptDocumentId: string | null;
      patient: { id: string; fullName: string };
      appointment: { id: string; startsAt: Date } | null;
    }>;
    totals: {
      count: number;
      totalCents: number;
      avgCents: number;
      byMethod: Record<string, { count: number; totalCents: number }>;
    };
    monthsRollup: Array<{ month: string; totalCents: number; count: number }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const where: Record<string, unknown> = {
        paymentDate: { gte: fromDate, lte: toDate },
      };
      if (method && METHOD_LABEL[method]) {
        where.externalPaymentMethod = method;
      }
      if (q) {
        where.patient = { fullName: { contains: q, mode: "insensitive" } };
      }

      const [payments, allInRange] = await Promise.all([
        tx.patientPayment.findMany({
          where,
          orderBy: { paymentDate: "desc" },
          take: 200,
          include: {
            patient: { select: { id: true, fullName: true } },
            appointment: { select: { id: true, startsAt: true } },
          },
        }),
        tx.patientPayment.findMany({
          where: { paymentDate: { gte: fromDate, lte: toDate } },
          select: {
            amountCents: true,
            externalPaymentMethod: true,
            paymentDate: true,
          },
        }),
      ]);

      // Aggregates
      const totalCents = allInRange.reduce(
        (s: number, p: { amountCents: number }) => s + p.amountCents,
        0,
      );
      const count = allInRange.length;
      const avgCents = count > 0 ? Math.round(totalCents / count) : 0;
      const byMethod: Record<string, { count: number; totalCents: number }> =
        {};
      for (const p of allInRange) {
        const m = p.externalPaymentMethod ?? "OTHER";
        if (!byMethod[m]) byMethod[m] = { count: 0, totalCents: 0 };
        byMethod[m].count++;
        byMethod[m].totalCents += p.amountCents;
      }

      // Últimos 6 meses (rolling) — independente do filtro
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      const rolling = await tx.patientPayment.findMany({
        where: { paymentDate: { gte: sixMonthsAgo } },
        select: { amountCents: true, paymentDate: true },
      });
      const monthsMap = new Map<
        string,
        { totalCents: number; count: number }
      >();
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthsMap.set(key, { totalCents: 0, count: 0 });
      }
      for (const p of rolling) {
        const d = new Date(p.paymentDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const cur = monthsMap.get(key) ?? { totalCents: 0, count: 0 };
        cur.totalCents += p.amountCents;
        cur.count++;
        monthsMap.set(key, cur);
      }
      const monthsRollup = Array.from(monthsMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v }));

      return {
        payments,
        totals: { count, totalCents, avgCents, byMethod },
        monthsRollup,
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) return null;

  const maxMonthTotal = Math.max(
    ...data.monthsRollup.map((m) => m.totalCents),
    1,
  );

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <Link href="/app" className="text-sm text-teal-700 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-600">
            Pagamentos registrados (EXTERNAL_RECORDED no MVP — Asaas chega no
            S22).
          </p>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total no período"
            value={brMoney(data.totals.totalCents)}
            sub={`${data.totals.count} pagamento(s)`}
          />
          <KpiCard
            label="Ticket médio"
            value={brMoney(data.totals.avgCents)}
            sub="por consulta"
          />
          <KpiCard
            label="Maior método"
            value={(() => {
              const top = Object.entries(data.totals.byMethod).sort(
                (a, b) => b[1].totalCents - a[1].totalCents,
              )[0];
              return top ? (METHOD_LABEL[top[0]]?.label ?? top[0]) : "—";
            })()}
            sub={(() => {
              const top = Object.entries(data.totals.byMethod).sort(
                (a, b) => b[1].totalCents - a[1].totalCents,
              )[0];
              return top
                ? `${brMoney(top[1].totalCents)} · ${top[1].count} pag.`
                : "";
            })()}
          />
          <KpiCard
            label="Período"
            value={`${fromDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} → ${toDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
            sub=""
          />
        </section>

        {/* 6-month chart */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            <BarChart3 className="inline h-4 w-4" strokeWidth={1.75} /> Últimos
            6 meses
          </h2>
          <div className="mt-4 flex items-end gap-2 h-32">
            {data.monthsRollup.map((m) => {
              const h = (m.totalCents / maxMonthTotal) * 100;
              return (
                <div
                  key={m.month}
                  className="flex-1 flex flex-col items-center"
                >
                  <div className="text-[10px] tabular-nums text-slate-600 mb-1">
                    {m.totalCents > 0 ? brMoney(m.totalCents) : ""}
                  </div>
                  <div
                    className="w-full rounded-t bg-teal-500"
                    style={{ height: `${Math.max(h, 2)}%`, minHeight: "2px" }}
                    title={`${m.month}: ${brMoney(m.totalCents)} · ${m.count} pag.`}
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    {(() => {
                      const [, mm] = m.month.split("-");
                      const months = [
                        "jan",
                        "fev",
                        "mar",
                        "abr",
                        "mai",
                        "jun",
                        "jul",
                        "ago",
                        "set",
                        "out",
                        "nov",
                        "dez",
                      ];
                      return months[Number(mm) - 1];
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Filters */}
        <form className="mt-6 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              De
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from ?? ymd(defaultFrom)}
              className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Até
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ymd(defaultTo)}
              className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Método
            </label>
            <select
              name="method"
              defaultValue={method ?? ""}
              className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-700">
              Paciente
            </label>
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nome..."
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            Filtrar
          </button>
        </form>

        {/* Table */}
        <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-base font-semibold">
              Pagamentos ({data.payments.length}
              {data.payments.length === 200 && "+"})
            </h2>
          </header>
          {data.payments.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Nenhum pagamento no período. Quando você concluir uma consulta com
              recibo, ela aparecerá aqui.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Paciente</th>
                    <th className="px-4 py-2 text-center">Método</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-left">Descrição</th>
                    <th className="px-4 py-2 text-center">Recibo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.payments.map((p) => {
                    const m =
                      p.externalPaymentMethod &&
                      METHOD_LABEL[p.externalPaymentMethod];
                    const s = STATUS_LABEL[p.status] ?? {
                      label: p.status,
                      color: "bg-slate-100",
                    };
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs">
                          {new Date(p.paymentDate).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/app/patients/${p.patient.id}`}
                            className="font-medium text-teal-700 hover:underline"
                          >
                            {p.patient.fullName}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-center text-xs">
                          {m ? (
                            <span
                              title={m.label}
                              className="inline-flex items-center gap-1"
                            >
                              <m.Icon
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              {m.label}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {brMoney(p.amountCents)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.color}`}
                          >
                            {s.label}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-600">
                          {p.description ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {p.receiptDocumentId ? (
                            <a
                              href={`/api/v1/documents/${p.receiptDocumentId}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              <FileText
                                className="inline h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />{" "}
                              PDF
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}
