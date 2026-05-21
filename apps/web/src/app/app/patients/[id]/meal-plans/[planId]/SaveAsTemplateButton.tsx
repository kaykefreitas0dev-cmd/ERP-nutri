"use client";

import { useState, useRef } from "react";
import { BookMarked, Loader2, Check, X } from "lucide-react";
import { saveAsMealPlanTemplateAction } from "../actions";

interface Props {
  mealPlanId: string;
  defaultName: string;
}

/**
 * Floating button that saves the current meal plan as a reusable template.
 * Shows inline form on click → saves → brief success state.
 */
export function SaveAsTemplateButton({ mealPlanId, defaultName }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function openForm() {
    setName(defaultName);
    setDescription("");
    setError(null);
    setSaved(false);
    setOpen(true);
    setTimeout(() => nameRef.current?.select(), 20);
  }

  async function handleSave() {
    setError(null);
    const n = name.trim();
    if (!n || n.length < 2) {
      setError("Nome deve ter ao menos 2 caracteres");
      return;
    }
    setSaving(true);
    const result = await saveAsMealPlanTemplateAction({
      mealPlanId,
      name: n,
      description: description.trim() || undefined,
    });
    setSaving(false);

    if (result.ok) {
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 1_800);
    } else {
      setError(result.message ?? "Erro ao salvar modelo");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-caption text-text-secondary transition-colors hover:border-brand-primary hover:bg-brand-primary-bg hover:text-brand-primary"
        title="Salvar como modelo reutilizável"
      >
        <BookMarked className="h-3.5 w-3.5" strokeWidth={1.75} />
        Salvar como modelo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-brand-primary bg-bg-surface p-3 [box-shadow:var(--shadow-sm)] min-w-[260px]">
      <div className="flex items-center justify-between">
        <p className="text-tiny font-semibold text-text-primary">
          Salvar como modelo
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-text-muted hover:text-text-secondary"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <input
        ref={nameRef}
        type="text"
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Nome do modelo"
        className="w-full rounded-md border border-border-default bg-bg-subtle px-2.5 py-1.5 text-caption focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        aria-label="Nome do modelo"
      />

      <input
        type="text"
        maxLength={200}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Descrição (opcional)"
        className="w-full rounded-md border border-border-default bg-bg-subtle px-2.5 py-1.5 text-caption focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        aria-label="Descrição do modelo"
      />

      {error && (
        <p className="text-tiny text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || saved}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-caption font-medium text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Salvando…
          </>
        ) : saved ? (
          <>
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Modelo salvo!
          </>
        ) : (
          <>
            <BookMarked className="h-3.5 w-3.5" strokeWidth={1.75} />
            Salvar modelo
          </>
        )}
      </button>
    </div>
  );
}
