"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

  function handleIssue() {
    if (!confirm("Assinar e emitir? Documento ficará imutável após esta ação."))
      return;
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
          className="rounded-md border border-border-default bg-white px-3 py-1.5 text-sm font-medium hover:bg-bg-subtle"
        >
          📥 {status === "DRAFT" ? "Visualizar PDF" : "Baixar PDF"}
        </a>

        {status === "DRAFT" && (
          <button
            type="button"
            onClick={handleIssue}
            disabled={pending}
            className="rounded-md bg-brand-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? "Assinando…" : "✍️ Assinar e emitir"}
          </button>
        )}

        {status === "ISSUED" && !showRevoke && (
          <button
            type="button"
            onClick={() => setShowRevoke(true)}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Revogar
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      {showRevoke && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3">
          <label
            htmlFor="revoke-reason"
            className="block text-xs font-medium text-red-800"
          >
            Motivo da revogação *
          </label>
          <input
            id="revoke-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: dados incorretos"
            className="mt-1 block w-64 rounded-md border border-red-300 px-2 py-1 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleRevoke}
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
              className="rounded-md border border-border-default bg-white px-3 py-1 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
