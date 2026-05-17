"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anonymizePatientAction, archivePatientAction } from "./actions";

interface Props {
  patientId: string;
  patientName: string;
  status: string;
}

const CONFIRM_PHRASE = "ANONIMIZAR DADOS";

export function AnonymizeButton({ patientId, patientName, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAnonymize, setShowAnonymize] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "ANONYMIZED") {
    return (
      <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700">
        🔒 Paciente anonimizado — dados não recuperáveis (LGPD)
      </div>
    );
  }

  function handleArchive() {
    const verb = status === "ARCHIVED" ? "desarquivar" : "arquivar";
    if (!confirm(`Confirmar ${verb} este paciente?`)) return;
    startTransition(async () => {
      const r = await archivePatientAction(patientId);
      if (!r.ok) {
        alert(r.message ?? "Erro");
        return;
      }
      router.refresh();
    });
  }

  function handleAnonymize() {
    setError(null);
    if (confirmText.trim().toUpperCase() !== CONFIRM_PHRASE) {
      setError(`Digite exatamente "${CONFIRM_PHRASE}"`);
      return;
    }
    if (reason.trim().length < 10) {
      setError("Motivo precisa ter pelo menos 10 caracteres");
      return;
    }
    startTransition(async () => {
      const r = await anonymizePatientAction({
        patientId,
        confirmPhrase: confirmText,
        reason: reason.trim(),
      });
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      // Sucesso: redirect para lista (paciente não tem mais sentido aberto)
      router.push("/app/patients");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {!showAnonymize ? (
        <>
          <button
            type="button"
            onClick={handleArchive}
            disabled={pending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {status === "ARCHIVED" ? "↩️ Desarquivar" : "📦 Arquivar"}
          </button>
          <button
            type="button"
            onClick={() => setShowAnonymize(true)}
            className="block w-full rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          >
            🔒 Anonimizar (LGPD)
          </button>
        </>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <header className="border-b border-red-200 bg-red-50 px-5 py-3">
              <h2 className="text-lg font-bold text-red-900">
                🔒 Anonimizar dados de {patientName}
              </h2>
            </header>

            <div className="space-y-4 p-5">
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-semibold">⚠️ Ação irreversível</p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                  <li>Nome, CPF, email, telefone, endereço — apagados</li>
                  <li>Anamnese clínica — preservada (sem identificação)</li>
                  <li>
                    Documentos emitidos (atestados, recibos) — preservados (Lock
                    15 — prova fiscal)
                  </li>
                  <li>Convites pendentes — revogados</li>
                  <li>
                    Conta do paciente (apps/patient) —{" "}
                    <strong>não afetada</strong> (paciente pode existir em
                    outras clínicas)
                  </li>
                </ul>
              </div>

              <div>
                <label
                  htmlFor="reason"
                  className="block text-xs font-medium text-slate-700"
                >
                  Motivo da anonimização * (será gravado em audit log)
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Solicitação do titular via email em DD/MM/AAAA conforme LGPD Art. 18, V"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {reason.length} / 500 (mínimo 10)
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="block text-xs font-medium text-slate-700"
                >
                  Para confirmar, digite{" "}
                  <code className="rounded bg-slate-100 px-1 font-mono">
                    {CONFIRM_PHRASE}
                  </code>{" "}
                  abaixo
                </label>
                <input
                  id="confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  className="mt-1 block w-full rounded-md border border-red-300 px-3 py-2 font-mono text-sm uppercase"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnonymize(false);
                    setConfirmText("");
                    setReason("");
                    setError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAnonymize}
                  disabled={
                    pending ||
                    confirmText.trim().toUpperCase() !== CONFIRM_PHRASE ||
                    reason.trim().length < 10
                  }
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Anonimizando..." : "🔒 Confirmar anonimização"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
