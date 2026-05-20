"use client";

import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteAnthropometryAction } from "./actions";

interface Props {
  recordId: string;
  patientId: string;
  /** Short label shown in the confirmation prompt (e.g. "14/05/26"). */
  dateLabel: string;
}

/**
 * DeleteAnthropometryButton — inline two-step delete with confirmation.
 *
 * Step 1: small Trash2 icon, subtle gray.
 * Step 2 (after click): inline confirmation row with "Excluir?" text + confirm/cancel buttons.
 * No window.confirm() — fully accessible.
 */
export function DeleteAnthropometryButton({
  recordId,
  patientId,
  dateLabel,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDeleteClick() {
    setError(null);
    setConfirming(true);
  }

  function handleCancel() {
    setConfirming(false);
    setError(null);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAnthropometryAction(recordId, patientId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao excluir");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <p className="text-tiny text-text-secondary">
          Excluir medição de{" "}
          <span className="font-medium text-text-primary">{dateLabel}</span>?
        </p>
        {error && <p className="text-tiny text-danger">{error}</p>}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded px-2 py-0.5 text-tiny font-medium bg-danger text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {isPending ? "Excluindo…" : "Excluir"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-tiny text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          >
            <X className="h-3 w-3" strokeWidth={2} />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDeleteClick}
      title="Excluir medição"
      aria-label={`Excluir medição de ${dateLabel}`}
      className="absolute right-2 top-2 rounded p-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg-subtle hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}
