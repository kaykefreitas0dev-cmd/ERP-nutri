"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSignature } from "lucide-react";
import { issueDocumentAction, revokeDocumentAction } from "../actions";

interface Props {
  documentId: string;
  status: string;
}

export function DocumentActions({ documentId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRevoke, setShowRevoke] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingIssue, setConfirmingIssue] = useState(false);

  function handleIssue() {
    setError(null);
    setConfirmingIssue(true);
  }

  function confirmIssue() {
    setConfirmingIssue(false);
    setError(null);
    startTransition(async () => {
      const r = await issueDocumentAction(documentId);
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      router.refresh();
    });
  }

  function handleRevoke() {
    if (reason.trim().length < 3) {
      setError("Motivo obrigatório (mínimo 3 caracteres)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await revokeDocumentAction(documentId, reason.trim());
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      setShowRevoke(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <a
          href={`/api/v1/documents/${documentId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 py-1.5 text-body font-medium hover:bg-bg-subtle"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          {status === "DRAFT" ? "Visualizar PDF" : "Baixar PDF"}
        </a>

        {status === "DRAFT" && !confirmingIssue && (
          <button
            type="button"
            onClick={handleIssue}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-4 py-1.5 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? (
              "Assinando…"
            ) : (
              <>
                <FileSignature className="h-4 w-4" strokeWidth={1.75} />
                Assinar e emitir
              </>
            )}
          </button>
        )}

        {status === "ISSUED" && !showRevoke && (
          <button
            type="button"
            onClick={() => setShowRevoke(true)}
            className="rounded-md border border-danger bg-bg-surface px-3 py-1.5 text-body font-medium text-danger hover:bg-danger-bg"
          >
            Revogar
          </button>
        )}
      </div>

      {confirmingIssue && (
        <div className="rounded-md border border-warning-border bg-warning-bg p-3">
          <p className="text-tiny font-medium text-warning">
            Assinar e emitir? O documento ficará imutável após esta ação.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirmIssue}
              disabled={pending}
              className="rounded-md bg-brand-primary px-3 py-1 text-tiny font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              Confirmar emissão
            </button>
            <button
              type="button"
              onClick={() => setConfirmingIssue(false)}
              className="rounded-md border border-border-default bg-bg-surface px-3 py-1 text-tiny"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      )}

      {showRevoke && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-3">
          <label
            htmlFor="revoke-reason"
            className="block text-tiny font-medium text-danger"
          >
            Motivo da revogação *
          </label>
          <input
            id="revoke-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: dados incorretos"
            className="mt-1 block w-64 rounded-md border border-danger px-2 py-1 text-body"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleRevoke}
              disabled={pending}
              className="rounded-md bg-danger px-3 py-1 text-tiny font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Revogando…" : "Confirmar revogação"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRevoke(false);
                setReason("");
                setError(null);
              }}
              className="rounded-md border border-border-default bg-bg-surface px-3 py-1 text-tiny"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
