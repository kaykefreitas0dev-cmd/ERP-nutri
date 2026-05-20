"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Archive, Undo2, AlertTriangle } from "lucide-react";
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
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  if (status === "ANONYMIZED") {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-tiny text-text-secondary">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
        Paciente anonimizado — dados não recuperáveis (LGPD)
      </div>
    );
  }

  function handleArchive() {
    setArchiveError(null);
    setConfirmingArchive(true);
  }

  function confirmArchive() {
    setConfirmingArchive(false);
    startTransition(async () => {
      const r = await archivePatientAction(patientId);
      if (!r.ok) {
        setArchiveError(r.message ?? "Erro ao arquivar");
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
          {confirmingArchive ? (
            <div className="flex items-center gap-2 rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-tiny">
              <span className="flex-1 text-text-secondary">
                {status === "ARCHIVED" ? "Desarquivar" : "Arquivar"} este
                paciente?
              </span>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={pending}
                className="rounded px-2 py-0.5 font-medium text-text-primary hover:bg-bg-surface-hover disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingArchive(false)}
                className="rounded px-2 py-0.5 text-text-muted hover:bg-bg-surface-hover"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleArchive}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 py-1.5 text-tiny hover:bg-bg-subtle disabled:opacity-50"
            >
              {status === "ARCHIVED" ? (
                <>
                  <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Desarquivar
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Arquivar
                </>
              )}
            </button>
          )}
          {archiveError && (
            <p role="alert" className="text-tiny text-danger">
              {archiveError}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowAnonymize(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-danger bg-bg-surface px-3 py-1.5 text-tiny text-danger hover:bg-danger-bg"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Anonimizar (LGPD)
          </button>
        </>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-bg-surface [box-shadow:var(--shadow-xl)]">
            <header className="border-b border-danger-border bg-danger-bg px-5 py-3">
              <h2 className="flex items-center gap-2 text-h3 font-bold text-danger">
                <Lock className="h-5 w-5" strokeWidth={2} />
                Anonimizar dados de {patientName}
              </h2>
            </header>

            <div className="space-y-4 p-5">
              <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-body text-danger">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                  Ação irreversível
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-tiny">
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
                  className="block text-tiny font-medium text-text-secondary"
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
                  className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
                />
                <p className="mt-1 text-tiny text-text-muted">
                  {reason.length} / 500 (mínimo 10)
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="block text-tiny font-medium text-text-secondary"
                >
                  Para confirmar, digite{" "}
                  <code className="rounded bg-bg-subtle px-1 font-mono">
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
                  className="mt-1 block w-full rounded-md border border-danger px-3 py-2 font-mono text-body uppercase"
                />
              </div>

              {error && (
                <p role="alert" className="text-body text-danger">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnonymize(false);
                    setConfirmText("");
                    setReason("");
                    setError(null);
                  }}
                  className="rounded-md border border-border-default bg-bg-surface px-4 py-2 text-body"
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-danger px-4 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? (
                    "Anonimizando..."
                  ) : (
                    <>
                      <Lock className="h-4 w-4" strokeWidth={2} />
                      Confirmar anonimização
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
