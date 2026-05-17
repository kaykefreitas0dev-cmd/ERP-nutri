import {
  Smartphone,
  CreditCard,
  Banknote,
  Landmark,
  HelpCircle,
  Hospital,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamentos — NutriCore" };

const METHOD_LABEL: Record<string, { label: string; Icon: LucideIcon }> = {
  PIX: { label: "PIX", Icon: Smartphone },
  CARD_EXTERNAL: { label: "Cartão", Icon: CreditCard },
  CASH: { label: "Dinheiro", Icon: Banknote },
  BANK_TRANSFER: { label: "Transferência", Icon: Landmark },
  OTHER: { label: "Outro", Icon: HelpCircle },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  EXTERNAL_RECORDED: { label: "Pago", color: "bg-green-100 text-green-800" },
  PENDING: { label: "Pendente", color: "bg-amber-100 text-amber-800" },
  PAID: { label: "Pago", color: "bg-green-100 text-green-800" },
  REFUNDED: { label: "Estornado", color: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelado", color: "bg-bg-muted text-text-secondary" },
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
      <h1 className="text-2xl font-bold text-text-primary">Pagamentos</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Recibos das consultas que você pagou
      </p>

      {payments.length > 0 && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-primary-bg p-4">
          <p className="text-xs text-brand-primary-hover">
            Total acumulado pago
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-primary">
            {brMoney(totalAll)}
          </p>
          <p className="text-xs text-brand-primary">
            {payments.length} pagamento(s) registrado(s)
          </p>
        </div>
      )}

      <div className="mt-6">
        {payments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-8 text-center text-text-secondary">
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
                color: "bg-bg-subtle",
              };
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-border-subtle bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tabular-nums text-text-primary">
                          {brMoney(p.amountCents)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.color}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-secondary">
                        {new Date(p.paymentDate).toLocaleDateString("pt-BR")}
                        {m && (
                          <>
                            {" · "}
                            <m.Icon className="h-3 w-3" strokeWidth={1.75} />
                            {m.label}
                          </>
                        )}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-text-muted">
                        <Hospital className="h-3 w-3" strokeWidth={1.75} />
                        {p.patient.organization.name}
                      </p>
                      {p.description && (
                        <p className="mt-1 text-xs text-text-secondary italic">
                          &ldquo;{p.description}&rdquo;
                        </p>
                      )}
                    </div>
                    {p.receiptDocumentId && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_NUTRI_APP_URL ?? ""}/api/v1/documents/${p.receiptDocumentId}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary-hover"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Recibo
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
