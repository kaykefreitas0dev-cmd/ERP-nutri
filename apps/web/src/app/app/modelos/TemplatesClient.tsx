"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ChevronRight, LayoutTemplate } from "lucide-react";
import type { TemplateListItem } from "./actions";
import { renameTemplateAction, deleteTemplateAction } from "./actions";

interface Props {
  templates: TemplateListItem[];
}

export function TemplatesClient({ templates: initial }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initial);

  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          onRename={(id, name) => {
            setItems((prev) =>
              prev.map((x) => (x.id === id ? { ...x, name } : x)),
            );
            startTransition(() => router.refresh());
          }}
          onDelete={(id) => {
            setItems((prev) => prev.filter((x) => x.id !== id));
          }}
        />
      ))}
    </ul>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Individual card
// ──────────────────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onRename,
  onDelete,
}: {
  template: TemplateListItem;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [, startTransition] = useTransition();

  // Rename state
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(template.name);
  const [localName, setLocalName] = useState(template.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEdit() {
    setNameValue(localName);
    setRenameError(null);
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 20);
  }

  function commitEdit() {
    const next = nameValue.trim();
    setEditing(false);
    if (!next || next === localName) return;
    if (next.length < 2 || next.length > 120) {
      setRenameError("Nome deve ter entre 2 e 120 caracteres");
      return;
    }
    const prev = localName;
    setLocalName(next);
    onRename(template.id, next);
    startTransition(async () => {
      const res = await renameTemplateAction({ id: template.id, name: next });
      if (!res.ok) {
        setLocalName(prev);
        setRenameError(res.message ?? "Erro ao renomear");
      }
    });
  }

  function cancelEdit() {
    setNameValue(localName);
    setEditing(false);
  }

  function handleDelete() {
    onDelete(template.id);
    startTransition(async () => {
      const res = await deleteTemplateAction({ id: template.id });
      if (!res.ok) {
        setDeleteError(res.message ?? "Erro ao excluir");
      }
    });
  }

  return (
    <li className="group/card rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <LayoutTemplate
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
          strokeWidth={1.75}
        />

        <div className="min-w-0 flex-1">
          {/* Name — editable */}
          <div className="group/name flex items-center gap-1.5">
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                maxLength={120}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                className="w-full rounded border border-brand-primary bg-bg-surface px-2 py-0.5 text-body font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                aria-label="Nome do modelo"
              />
            ) : (
              <button
                type="button"
                onClick={startEdit}
                title="Clique para renomear"
                className="flex min-w-0 items-center gap-1 rounded px-0.5 text-body font-medium text-text-primary transition-colors hover:bg-bg-subtle"
              >
                <span className="truncate">{localName}</span>
                <Pencil
                  className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover/name:opacity-100"
                  strokeWidth={1.75}
                />
              </button>
            )}
          </div>

          {renameError && (
            <p className="mt-0.5 text-tiny text-danger">{renameError}</p>
          )}

          {/* Description */}
          {template.description && (
            <p className="mt-0.5 text-caption text-text-secondary">
              {template.description}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-tiny text-text-muted">
            {template.dayCount > 0 && (
              <span>
                {template.dayCount} {template.dayCount === 1 ? "dia" : "dias"}
              </span>
            )}
            {template.totalKcal != null && (
              <span className="tabular-nums">
                {template.totalKcal.toLocaleString("pt-BR")} kcal/dia
              </span>
            )}
            {template.targetKcal != null && (
              <span className="tabular-nums text-text-muted">
                meta: {template.targetKcal.toLocaleString("pt-BR")} kcal
              </span>
            )}
            {template.usageCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3" strokeWidth={2} />
                Usado {template.usageCount}×
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <div className="shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-tiny text-danger">Excluir?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded px-2 py-0.5 text-tiny font-medium text-danger ring-1 ring-danger transition-colors hover:bg-danger hover:text-white"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-tiny text-text-muted hover:text-text-secondary"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
              title="Excluir modelo"
              aria-label={`Excluir modelo ${localName}`}
              className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-danger-bg hover:text-danger group-hover/card:opacity-100"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {deleteError && (
        <p className="mt-2 text-tiny text-danger">{deleteError}</p>
      )}
    </li>
  );
}
