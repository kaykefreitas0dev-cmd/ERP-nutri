"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Search,
  Loader2,
  Smartphone,
  CreditCard,
  Banknote,
  Landmark,
  HelpCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  searchPatientsForPaymentAction,
  createStandalonePaymentAction,
} from "./actions";

interface Patient {
  id: string;
  fullName: string;
  email: string | null;
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

interface Props {
  onClose: () => void;
}

export function RegisterPaymentModal({ onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Patient search state
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment form state
  const [amountReais, setAmountReais] = useState("");
  const [method, setMethod] = useState<
    "PIX" | "CARD_EXTERNAL" | "CASH" | "BANK_TRANSFER" | "OTHER"
  >("PIX");
  const [paymentDate, setPaymentDate] = useState(todayLocalISO());
  const [description, setDescription] = useState("Consulta nutricional");
  const [reference, setReference] = useState("");
  const [generateReceipt, setGenerateReceipt] = useState(true);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, onClose]);

  // Debounced patient search
  function handlePatientSearch(q: string) {
    setPatientQuery(q);
    setSelectedPatient(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.trim().length < 2) {
      setPatientResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const res = await searchPatientsForPaymentAction(q);
      if (res.ok && res.patients) setPatientResults(res.patients);
      setSearching(false);
    }, 300);
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientQuery(p.fullName);
    setPatientResults([]);
    setSearching(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPatient) {
      setError("Selecione um paciente");
      return;
    }
    const reais = Number(amountReais.replace(",", "."));
    if (!Number.isFinite(reais) || reais <= 0) {
      setError("Valor inválido");
      return;
    }

    startTransition(async () => {
      const r = await createStandalonePaymentAction({
        patientId: selectedPatient.id,
        amountCents: Math.round(reais * 100),
        paymentMethod: method,
        paymentDate,
        description: description.trim() || "Consulta nutricional",
        externalReference: reference.trim() || undefined,
        generateReceipt,
      });
      if (!r.ok) {
        setError(r.message ?? "Erro ao registrar pagamento");
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => onClose(), 1200);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-payment-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-bg-surface [box-shadow:var(--shadow-xl)]"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-5 py-3">
          <h2
            id="reg-payment-title"
            className="text-h3 font-semibold text-text-primary"
          >
            Registrar pagamento
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fechar"
            className="rounded p-1 text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary disabled:opacity-50"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        {/* Body — scrollable */}
        <div className="overflow-y-auto">
          <form
            id="reg-payment-form"
            onSubmit={handleSubmit}
            className="space-y-4 p-5"
          >
            {/* Success state */}
            {success && (
              <div className="rounded-md bg-success-bg px-4 py-3 text-body font-medium text-success ring-1 ring-inset ring-success-border">
                Pagamento registrado com sucesso!
              </div>
            )}

            {/* Patient search */}
            <div className="relative">
              <label
                htmlFor="patient-search"
                className="block text-tiny font-medium text-text-secondary"
              >
                Paciente *
              </label>
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  strokeWidth={1.75}
                />
                <input
                  id="patient-search"
                  type="search"
                  autoComplete="off"
                  value={patientQuery}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  placeholder="Buscar paciente pelo nome…"
                  className="block w-full rounded-md border border-border-default bg-bg-surface py-2 pl-9 pr-3 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
                {searching && (
                  <Loader2
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted"
                    strokeWidth={1.75}
                  />
                )}
              </div>

              {/* Dropdown results */}
              {patientResults.length > 0 && !selectedPatient && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border-default bg-bg-surface [box-shadow:var(--shadow-md)]">
                  {patientResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-bg-subtle"
                      >
                        <span className="text-body font-medium text-text-primary">
                          {p.fullName}
                        </span>
                        {p.email && (
                          <span className="text-tiny text-text-muted">
                            {p.email}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Selected patient chip */}
              {selectedPatient && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-primary-bg px-3 py-0.5 text-tiny font-medium text-brand-primary ring-1 ring-inset ring-brand-primary/20">
                  {selectedPatient.fullName}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientQuery("");
                    }}
                    aria-label="Remover paciente selecionado"
                    className="rounded-full hover:text-brand-primary-hover"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>

            {/* Amount */}
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
                autoFocus={false}
                value={amountReais}
                onChange={(e) => setAmountReais(e.target.value)}
                placeholder="ex: 250,00"
                className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-tiny font-medium text-text-secondary">
                Forma de pagamento *
              </label>
              <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {METHODS.map((m) => {
                  const ItemIcon = m.Icon;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`flex flex-col items-center rounded-md border p-2 text-tiny transition-colors duration-fast ${
                        method === m.value
                          ? "border-brand-primary bg-brand-primary-bg ring-1 ring-brand-primary text-brand-primary"
                          : "border-border-default bg-bg-surface text-text-secondary hover:border-border-strong hover:bg-bg-subtle"
                      }`}
                    >
                      <ItemIcon className="h-5 w-5" strokeWidth={1.75} />
                      <div className="mt-0.5 font-medium">{m.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment date */}
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
                className="mt-1 block w-44 rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Description */}
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
                className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* External reference */}
            <div>
              <label
                htmlFor="reference"
                className="block text-tiny font-medium text-text-secondary"
              >
                Referência externa{" "}
                <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="reference"
                type="text"
                maxLength={160}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="ID Asaas pessoal, link comprovante, etc."
                className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Generate receipt */}
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
                    Não substitui a NF-e — emita NF-e manualmente no seu sistema
                    fiscal.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
          </form>
        </div>

        {/* Footer — always visible */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border-subtle px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border-default bg-bg-surface px-4 py-2 text-body transition-colors hover:bg-bg-subtle disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="reg-payment-form"
            disabled={pending || success}
            className="rounded-md bg-brand-primary px-5 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Salvando…
              </span>
            ) : (
              "Registrar pagamento"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
