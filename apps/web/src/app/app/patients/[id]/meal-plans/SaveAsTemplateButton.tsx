"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { BookmarkPlus, X, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveAsTemplateAction } from "./template-actions";

interface Props {
  planId: string;
  patientId: string;
  /** Plan name — pre-fills the template name. */
  originalName: string;
}

/**
 * SaveAsTemplateButton — inline two-step "salvar como modelo".
 *
 * Step 1: ghost Bookmark icon in the plan card (visible on group-hover).
 * Step 2: slide-down input row with name + description + confirm/cancel.
 * On success: small confirmation flash, then collapses.
 */
export function SaveAsTemplateButton({
  planId,
  patientId,
  originalName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setName(originalName);
    setDescription("");
    setError(null);
    setSaved(false);
    setOpen(true);
  }

  useEffect(() => {
    if (open) {
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
      const result = await saveAsTemplateAction({
        planId,
        patientId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setOpen(false), 1200);
      } else {
        setError(result.message ?? "Erro ao salvar modelo");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") handleCancel();
  }

  return (
    <div className="mt-1">
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          title="Salvar como modelo"
          aria-label={`Salvar plano "${originalName}" como modelo`}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-tiny text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg-subtle hover:text-text-secondary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
        >
          <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Salvar como modelo
        </button>
      ) : (
        <div className="mt-1 flex w-full flex-col gap-2 rounded-md border border-border-subtle bg-bg-subtle p-3">
          {saved ? (
            <p className="inline-flex items-center gap-1.5 text-tiny font-medium text-success">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Modelo salvo! Disponível ao criar novos planos.
            </p>
          ) : (
            <>
              <p className="text-tiny font-medium text-text-secondary">
                Nome do modelo
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
                placeholder="Ex: Low carb 1800kcal"
                className="w-full rounded border border-border-default bg-bg-surface px-2.5 py-1.5 text-tiny text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
                disabled={isPending}
                placeholder="Descrição (opcional)"
                className="w-full rounded border border-border-default bg-bg-surface px-2.5 py-1.5 text-tiny text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
              />
              {error && <p className="text-tiny text-danger">{error}</p>}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded bg-brand-primary px-2.5 py-1 text-tiny font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2
                        className="h-3 w-3 animate-spin"
                        strokeWidth={2}
                      />
                      Salvando…
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                      Salvar modelo
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
