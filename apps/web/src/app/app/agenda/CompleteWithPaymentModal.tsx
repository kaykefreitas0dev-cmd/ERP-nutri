"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  icon: string;
}> = [
  { value: "PIX", label: "PIX", icon: "📲" },
  { value: "CARD_EXTERNAL", label: "Cartão", icon: "💳" },
  { value: "CASH", label: "Dinheiro", icon: "💵" },
  { value: "BANK_TRANSFER", label: "Transferência", icon: "🏦" },
  { value: "OTHER", label: "Outro", icon: "❓" },
];

function todayLocalISO(): string {
  return new Date().toISOString().slice(0, 10);
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
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Concluir consulta
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
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
              className="block text-xs font-medium text-slate-700"
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
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </div>

          {/* Método */}
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Forma de pagamento *
            </label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`rounded-md border p-2 text-xs transition ${
                    method === m.value
                      ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="text-base">{m.icon}</div>
                  <div className="mt-0.5 font-medium">{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Data pagamento */}
          <div>
            <label
              htmlFor="paymentDate"
              className="block text-xs font-medium text-slate-700"
            >
              Data do pagamento *
            </label>
            <input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={todayLocalISO()}
              className="mt-1 block w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Descrição */}
          <div>
            <label
              htmlFor="description"
              className="block text-xs font-medium text-slate-700"
            >
              Descrição do serviço
            </label>
            <input
              id="description"
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Referência externa */}
          <div>
            <label
              htmlFor="reference"
              className="block text-xs font-medium text-slate-700"
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
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Gerar recibo */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={generateReceipt}
                onChange={(e) => setGenerateReceipt(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Gerar recibo simples (PDF)</strong>
                <span className="block text-xs text-slate-600">
                  Recibo assinado eletronicamente. ⚠️ Não substitui a NF-e —
                  emita NF-e manualmente em seu sistema fiscal.
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Concluir + registrar pagamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
