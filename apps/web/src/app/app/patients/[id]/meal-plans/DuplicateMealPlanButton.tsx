"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Copy, X, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { duplicateMealPlanAction } from "./actions";

interface Props {
  planId: string;
  patientId: string;
  /** Original plan name — pre-fills the new name as "{name} (cópia)". */
  originalName: string;
}

/**
 * DuplicateMealPlanButton — inline two-step duplicate with editable name.
 *
 * Step 1: ghost Copy icon in the plan card (visible on group-hover).
 * Step 2: slide-down input row with name field + confirm + cancel.
 * On success: router.refresh() to reload list with new plan at top.
 */
export function DuplicateMealPlanButton({
  planId,
  patientId,
  originalName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-fill name when opening
  function handleOpen() {
    setName(`${originalName} (cópia)`);
    setError(null);
    setOpen(true);
  }

  // Focus input after open animation
  useEffect(() => {
    if (open) {
      // Small delay so the element is rendered
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  function handleCancel() {
    setOpen(false);
    setError(null);
  }

  function handleConfirm() {
    if (!name.trim() || name.trim().length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    startTransition(async () => {
      const result = await duplicateMealPlanAction({
        planId,
        patientId,
        newName: name.trim(),
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao duplicar");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") handleCancel();
  }

  return (
    <div className="mt-2.5">
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          title="Duplicar plano"
          aria-label={`Duplicar plano "${originalName}"`}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-tiny text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg-subtle hover:text-text-secondary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          Duplicar
        </button>
      ) : (
        <div className="mt-1 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-subtle p-3">
          <p className="text-tiny font-medium text-text-secondary">
            Nome da cópia
          </p>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            maxLength={120}
            disabled={isPending}
            placeholder="Nome do novo plano"
            className="w-full rounded border border-border-default bg-bg-surface px-2.5 py-1.5 text-tiny text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
          />
          {error && <p className="text-tiny text-danger">{error}</p>}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-tiny font-medium bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                  Duplicando…
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  Duplicar
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-tiny text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
