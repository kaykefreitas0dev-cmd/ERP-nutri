"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  CreditCard,
  Banknote,
  Landmark,
  HelpCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { completeAppointmentWithPaymentAction } from "./payment-actions";

interface Appointment {
  id: string;
  patientId: string | null;
  patientName: string | null;
  externalPatientName: string | null;
  startsAt: Date | string;
}

interface Props {
  appointment: Appointment;
  onClose: () => void;
}

const METHODS: Array<{
  value: "PIX" | "CARD_EXTERNAL" | "CASH" | "BANK_TRANSFER" | "OTHER";
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "PIX", label: "PIX", Icon: Smartphone },
  { value: "CARD_EXTERNAL", label: "Cartão", Icon: CreditCard },
  { value: "CASH", label: "Dinheiro", Icon: Banknote },
  { value: "BANK_TRANSFER", label: "Transferência", Icon: Landmark },
  { value: "OTHER", label: "Outro", Icon: HelpCircle },
];

function todayLocalISO(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

export function CompleteWithPaymentModal({ appointment, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amountReais, setAmountReais] = useState<string>("");
  const [method, setMethod] = useState<
    "PIX" | "CARD_EXTERNAL" | "CASH" | "BANK_TRANSFER" | "OTHER"
  >("PIX");
  const [reference, setReference] = useState<string>("");
  const [description, setDescription] = useState<string>(
    "Consulta nutricional",
  );
  const [generateReceipt, setGenerateReceipt] = useState(true);
  const [paymentDate, setPaymentDate] = useState<string>(todayLocalISO());

  // Close on Escape key (only when not submitting)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const reais = Number(amountReais.replace(",", "."));
    if (!Number.isFinite(reais) || reais <= 0) {
      setError("Valor inválido");
      return;
    }
    const amountCents = Math.round(reais * 100);

    startTransition(async () => {
      const r = await completeAppointmentWithPaymentAction({
        appointmentId: appointment.id,
        amountCents,
        paymentMethod: method,
        externalReference: reference.trim() || undefined,
        description: description.trim() || undefined,
        generateReceipt,
        paymentDate,
      });
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const patientName =
    appointment.patientName ?? appointment.externalPatientName ?? "(paciente)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-appt-title"
        className="w-full max-w-md rounded-lg bg-bg-surface [box-shadow:var(--shadow-xl)]"
      >
        <header className="border-b border-border-subtle px-5 py-3">
          <h2
            id="complete-appt-title"
            className="text-h3 font-semibold text-text-primary"
          >
            Concluir consulta
          </h2>
          <p className="mt-0.5 text-tiny text-text-secondary">
            {patientName} ·{" "}
            {new Date(appointment.startsAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Valor */}
          <div>
            <label
              htmlFor="amount"
              className="block text-tiny font-medium text-text-secondary"
            >
              Valor cobrado (R$) *
            </label>
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={amountReais}
              onChange={(e) => setAmountReais(e.target.value)}
              placeholder="ex: 250,00"
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-base"
            />
          </div>

          {/* Método */}
          <div>
            <label className="block text-tiny font-medium text-text-secondary">
              Forma de pagamento *
            </label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {METHODS.map((m) => {
                const ItemIcon = m.Icon;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`flex flex-col items-center rounded-md border p-2 text-tiny transition-colors duration-fast ${
                      method === m.value
                        ? "border-brand-primary bg-brand-primary-bg ring-1 ring-brand-primary"
                        : "border-border-default bg-bg-surface hover:border-border-strong hover:bg-bg-subtle"
                    }`}
                  >
                    <ItemIcon className="h-5 w-5" strokeWidth={1.75} />
                    <div className="mt-0.5 font-medium">{m.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data pagamento */}
          <div>
            <label
              htmlFor="paymentDate"
              className="block text-tiny font-medium text-text-secondary"
            >
              Data do pagamento *
            </label>
            <input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={todayLocalISO()}
              className="mt-1 block w-44 rounded-md border border-border-default px-3 py-2 text-body"
            />
          </div>

          {/* Descrição */}
          <div>
            <label
              htmlFor="description"
              className="block text-tiny font-medium text-text-secondary"
            >
              Descrição do serviço
            </label>
            <input
              id="description"
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
            />
          </div>

          {/* Referência externa */}
          <div>
            <label
              htmlFor="reference"
              className="block text-tiny font-medium text-text-secondary"
            >
              Referência externa (opcional)
            </label>
            <input
              id="reference"
              type="text"
              maxLength={160}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ID Asaas, link comprovante, etc."
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
            />
          </div>

          {/* Gerar recibo */}
          <div className="rounded-md border border-border-subtle bg-bg-subtle p-3">
            <label className="flex items-start gap-2 text-body">
              <input
                type="checkbox"
                checked={generateReceipt}
                onChange={(e) => setGenerateReceipt(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Gerar recibo simples (PDF)</strong>
                <span className="mt-1 flex items-start gap-1.5 text-tiny text-text-secondary">
                  <TriangleAlert
                    className="mt-0.5 h-3 w-3 shrink-0"
                    strokeWidth={2}
                  />
                  <span>
                    Recibo assinado eletronicamente. Não substitui a NF-e —
                    emita NF-e manualmente em seu sistema fiscal.
                  </span>
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-default bg-bg-surface px-4 py-2 text-body transition-colors hover:bg-bg-subtle"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-success px-5 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Concluir + registrar pagamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
