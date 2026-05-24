"use client";

import { useState, useTransition } from "react";
import { LayoutTemplate, X, Check } from "lucide-react";
import { saveAsMealPlanTemplateAction } from "../actions";

interface Props {
  planId: string;
  suggestedName: string;
}

/**
 * Inline button that saves the current meal plan as a reusable template.
 * Click → small inline form (name + description) → submit → success flash.
 */
export function SaveAsTemplateButton({ planId, suggestedName }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setName(suggestedName);
    setDescription("");
    setError(null);
    setSavedOk(false);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    startTransition(async () => {
      const res = await saveAsMealPlanTemplateAction({
        planId,
        name: trimmedName,
        description: description.trim() || undefined,
      });
      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => {
          setOpen(false);
          setSavedOk(false);
        }, 1800);
      } else {
        setError(res.message ?? "Erro ao salvar modelo");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-caption font-medium text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary [box-shadow:var(--shadow-xs)]"
      >
        <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
        Salvar como modelo
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3 [box-shadow:var(--shadow-xs)]">
      {savedOk ? (
        /* Success state */
        <div className="flex items-center gap-2 text-success">
          <Check className="h-4 w-4" strokeWidth={2} />
          <span className="text-caption font-medium">Modelo salvo!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Salvar como modelo
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-0.5 text-text-muted hover:bg-bg-subtle hover:text-text-secondary"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do modelo"
            maxLength={120}
            required
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
              }
            }}
            className="block w-full rounded-md border border-border-default bg-bg-surface px-2.5 py-1.5 text-caption text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            aria-label="Nome do modelo"
            autoFocus
          />

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
              }
            }}
            className="block w-full rounded-md border border-border-default bg-bg-surface px-2.5 py-1.5 text-caption text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            aria-label="Descrição do modelo"
          />

          {error && <p className="text-tiny text-danger">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand-primary px-3 py-1.5 text-caption font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar modelo"}
          </button>
        </form>
      )}
    </div>
  );
}
