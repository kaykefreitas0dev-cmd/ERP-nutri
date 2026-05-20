"use client";

import { useEffect, useState, useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import {
  createClinicalNoteAction,
  listClinicalNotesAction,
  readClinicalNoteAction,
} from "./clinical-notes-actions";

interface Note {
  id: string;
  contentPreview: string | null;
  category: string;
  consultationDate: Date | string;
  createdAt: Date | string;
}

interface Props {
  patientId: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  evolution: "Evolução",
  anamnesis: "Anamnese",
  assessment: "Avaliação",
  plan: "Plano terapêutico",
};

export function ClinicalNotesSection({ patientId }: Props) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>(
    {},
  );
  const [decrypting, setDecrypting] = useState<string | null>(null);

  useEffect(() => {
    listClinicalNotesAction(patientId)
      .then((list) => setNotes(list as Note[]))
      .finally(() => setLoading(false));
  }, [patientId]);

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createClinicalNoteAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      setShowForm(false);
      // Reload
      const list = await listClinicalNotesAction(patientId);
      setNotes(list as Note[]);
    });
  }

  async function handleDecrypt(noteId: string) {
    if (decryptedNotes[noteId]) {
      // Toggle close
      setDecryptedNotes((prev) => {
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
      return;
    }
    setDecrypting(noteId);
    const result = await readClinicalNoteAction(noteId);
    if (result.ok && result.content !== undefined) {
      setDecryptedNotes((prev) => ({ ...prev, [noteId]: result.content! }));
    }
    setDecrypting(null);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-h2 font-semibold text-text-primary">
            Prontuário (Anotações clínicas)
          </h2>
          <p className="inline-flex items-center gap-1 text-tiny text-text-muted">
            <Lock className="h-3 w-3 shrink-0" strokeWidth={2} />
            Conteúdo criptografado em repouso. Cada leitura é auditada.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-3 text-body font-medium text-white hover:bg-brand-primary-hover"
          >
            + Nova anotação
          </button>
        )}
      </header>

      {showForm && (
        <form
          action={handleCreate}
          className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]"
        >
          <input type="hidden" name="patientId" value={patientId} />

          {error && (
            <div
              role="alert"
              className="mb-3 rounded-md bg-danger-bg p-3 text-body text-danger"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="block text-tiny font-medium">
                Categoria
              </label>
              <select
                id="category"
                name="category"
                defaultValue="evolution"
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              >
                <option value="evolution">Evolução</option>
                <option value="anamnesis">Anamnese</option>
                <option value="assessment">Avaliação</option>
                <option value="plan">Plano terapêutico</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="consultationDate"
                className="block text-tiny font-medium"
              >
                Data da consulta
              </label>
              <input
                id="consultationDate"
                name="consultationDate"
                type="datetime-local"
                defaultValue={new Date()
                  .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
                  .slice(0, 16)
                  .replace(" ", "T")}
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="content" className="block text-tiny font-medium">
              Conteúdo *
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={8}
              placeholder="Anamnese, evolução, observações clínicas..."
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 font-mono text-body"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border-default bg-bg-surface px-4 text-body font-medium hover:bg-bg-subtle"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar (criptografar)"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-body text-text-muted">Carregando…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default p-8 text-center text-body text-text-muted">
          Nenhuma anotação clínica registrada.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-tiny font-semibold uppercase tracking-wider text-brand-primary">
                    {CATEGORY_LABEL[note.category] ?? note.category}
                  </span>
                  <p className="text-tiny text-text-muted">
                    {new Date(note.consultationDate).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDecrypt(note.id)}
                  disabled={decrypting === note.id}
                  className="text-tiny font-medium text-brand-primary hover:underline disabled:opacity-50"
                >
                  {decrypting === note.id ? (
                    "Descriptografando…"
                  ) : decryptedNotes[note.id] ? (
                    "Esconder"
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <LockOpen className="h-3 w-3" strokeWidth={2} />
                      Ver conteúdo
                    </span>
                  )}
                </button>
              </div>

              {decryptedNotes[note.id] ? (
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-bg-subtle p-3 text-body text-text-secondary">
                  {decryptedNotes[note.id]}
                </p>
              ) : note.contentPreview ? (
                <p className="mt-2 text-body text-text-muted">
                  {note.contentPreview}…{" "}
                  <span className="text-tiny text-text-subtle">(preview)</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
