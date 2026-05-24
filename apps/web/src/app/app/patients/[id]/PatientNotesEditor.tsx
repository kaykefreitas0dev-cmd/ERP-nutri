"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Check, X, NotebookPen } from "lucide-react";
import { updatePatientNotesAction } from "../actions";

interface Props {
  patientId: string;
  initialNotes: string | null;
}

export function PatientNotesEditor({ patientId, initialNotes }: Props) {
  const [notes, setNotes] = useState<string | null>(initialNotes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function openEditor() {
    setDraft(notes ?? "");
    setError(null);
    setEditing(true);
    // Focus after render
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    const trimmed = draft.trim();
    const newValue = trimmed === "" ? null : trimmed;

    // No change → just close
    if (newValue === notes) {
      setEditing(false);
      return;
    }

    const prev = notes;
    setNotes(newValue); // optimistic
    setEditing(false);

    startTransition(async () => {
      const result = await updatePatientNotesAction({
        patientId,
        notes: newValue,
      });
      if (!result.ok) {
        setNotes(prev); // revert
        setError(result.message ?? "Erro ao salvar");
        setEditing(true);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      cancel();
    }
    // Ctrl+Enter / Cmd+Enter to save
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          maxLength={2000}
          placeholder="Adicione observações administrativas sobre o paciente…"
          className={[
            "w-full resize-y rounded-md border px-3 py-2 text-body text-text-primary",
            "bg-bg-surface placeholder:text-text-muted",
            "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1",
            error ? "border-danger focus:ring-danger" : "border-border-default",
          ].join(" ")}
        />
        {error && (
          <p className="text-tiny text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-primary px-3 text-tiny font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3 w-3" strokeWidth={2} />
            Salvar
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border-default bg-bg-surface px-3 text-tiny font-medium text-text-secondary transition-colors hover:bg-bg-surface-hover disabled:opacity-50"
          >
            <X className="h-3 w-3" strokeWidth={2} />
            Cancelar
          </button>
          <span className="ml-auto text-tiny text-text-muted">
            {draft.length}/2000 · Ctrl+Enter para salvar
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="group/notes relative">
      {notes ? (
        <>
          <p className="whitespace-pre-wrap text-body text-text-primary">
            {notes}
          </p>
          <button
            type="button"
            onClick={openEditor}
            aria-label="Editar observações"
            title="Editar observações"
            className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded text-text-muted opacity-0 transition-opacity group-hover/notes:opacity-100 hover:text-text-primary focus-visible:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={openEditor}
          className="inline-flex items-center gap-1.5 text-tiny text-text-muted transition-colors hover:text-text-primary"
        >
          <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.75} />
          Adicionar observação…
        </button>
      )}
    </div>
  );
}
