import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamentos — NutriCore" };

const METHOD_LABEL: Record<string, { label: string; icon: string }> = {
  PIX: { label: "PIX", icon: "📲" },
  CARD_EXTERNAL: { label: "Cartão", icon: "💳" },
  CASH: { label: "Dinheiro", icon: "💵" },
  BANK_TRANSFER: { label: "Transferência", icon: "🏦" },
  OTHER: { label: "Outro", icon: "❓" },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  EXTERNAL_RECORDED: { label: "Pago", color: "bg-green-100 text-green-800" },
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

export default async function PatientPaymentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patients = await prisma.patient.findMany({
    where: { userId: user!.id },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);

  const payments = patientIds.length
    ? await prisma.patientPayment.findMany({
        where: { patientId: { in: patientIds } },
        orderBy: { paymentDate: "desc" },
        take: 100,
        select: {
          id: true,
          paymentDate: true,
          amountCents: true,
          status: true,
          externalPaymentMethod: true,
          description: true,
          receiptDocumentId: true,
          patient: {
            select: { organization: { select: { name: true } } },
          },
        },
      })
    : [];

  // Total acumulado (todos os tempos)
  const totalAll = payments.reduce(
    (s, p) =>
      ["EXTERNAL_RECORDED", "PAID"].includes(p.status) ? s + p.amountCents : s,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <h1 className="text-2xl font-bold text-slate-900">Pagamentos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Recibos das consultas que você pagou
      </p>

      {payments.length > 0 && (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs text-teal-800">Total acumulado pago</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">
            {brMoney(totalAll)}
          </p>
          <p className="text-xs text-teal-700">
            {payments.length} pagamento(s) registrado(s)
          </p>
        </div>
      )}

      <div className="mt-6">
        {payments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Nenhum pagamento registrado ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => {
              const m =
                p.externalPaymentMethod &&
                METHOD_LABEL[p.externalPaymentMethod];
              const s = STATUS_LABEL[p.status] ?? {
                label: p.status,
                color: "bg-slate-100",
              };
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tabular-nums text-slate-900">
                          {brMoney(p.amountCents)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.color}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {new Date(p.paymentDate).toLocaleDateString("pt-BR")}
                        {m && (
                          <>
                            {" · "}
                            {m.icon} {m.label}
                          </>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        🏥 {p.patient.organization.name}
                      </p>
                      {p.description && (
                        <p className="mt-1 text-xs text-slate-600 italic">
                          &ldquo;{p.description}&rdquo;
                        </p>
                      )}
                    </div>
                    {p.receiptDocumentId && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_NUTRI_APP_URL ?? ""}/api/v1/documents/${p.receiptDocumentId}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                      >
                        📄 Recibo
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
