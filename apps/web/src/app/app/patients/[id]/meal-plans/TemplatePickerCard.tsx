"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate,
  Check,
  Loader2,
  Trash2,
  Globe,
  Target,
  CalendarDays,
} from "lucide-react";
import {
  applyTemplateAction,
  deleteTemplateAction,
  type TemplateSummary,
} from "./template-actions";

interface Props {
  patientId: string;
  templates: TemplateSummary[];
}

/**
 * TemplatePickerCard — lists reusable meal-plan templates (own org + public)
 * and applies one to the current patient (creates a new DRAFT plan).
 *
 * Apply: inline name field pre-filled with the template name → creates plan →
 * redirects to the editor. Own-org templates can be deleted; public ones can't.
 */
export function TemplatePickerCard({ patientId, templates }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isApplying, startApply] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  if (templates.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border-default bg-bg-surface p-5">
        <div className="flex items-center gap-2 text-text-secondary">
          <LayoutTemplate className="h-4 w-4" strokeWidth={1.75} />
          <h2 className="text-h3 font-semibold text-text-primary">Modelos</h2>
        </div>
        <p className="mt-2 text-tiny text-text-muted">
          Nenhum modelo ainda. Salve um plano como modelo (no menu de cada
          plano) para reutilizá-lo aqui.
        </p>
      </div>
    );
  }

  function handleSelect(id: string, templateName: string) {
    setSelectedId(id);
    setName(templateName);
    setError(null);
  }

  function handleApply(templateId: string) {
    if (!name.trim() || name.trim().length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    startApply(async () => {
      const result = await applyTemplateAction({
        templateId,
        patientId,
        name: name.trim(),
      });
      if (result.ok && result.mealPlanId) {
        router.push(
          `/app/patients/${patientId}/meal-plans/${result.mealPlanId}`,
        );
      } else {
        setError(result.message ?? "Erro ao aplicar modelo");
      }
    });
  }

  function handleDelete(templateId: string) {
    setDeletingId(templateId);
    startDelete(async () => {
      const result = await deleteTemplateAction(templateId);
      if (result.ok) {
        if (selectedId === templateId) setSelectedId(null);
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao excluir modelo");
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <div className="flex items-center gap-2">
        <LayoutTemplate
          className="h-4 w-4 text-brand-primary"
          strokeWidth={1.75}
        />
        <h2 className="text-h3 font-semibold text-text-primary">
          Usar um modelo
        </h2>
      </div>
      <p className="mt-1 text-tiny text-text-muted">
        Crie um plano a partir de um modelo salvo.
      </p>

      <ul className="mt-3 space-y-1.5">
        {templates.map((t) => {
          const isSelected = selectedId === t.id;
          return (
            <li
              key={t.id}
              className={
                "rounded-md border transition-colors " +
                (isSelected
                  ? "border-brand-primary bg-brand-primary-bg"
                  : "border-border-subtle bg-bg-subtle/40 hover:border-border-default")
              }
            >
              <div className="flex items-start gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => handleSelect(t.id, t.name)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body font-medium text-text-primary">
                      {t.name}
                    </span>
                    {t.isPublic && (
                      <span
                        title="Modelo público"
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-bg-subtle px-1.5 py-0.5 text-tiny text-text-muted ring-1 ring-inset ring-border-subtle"
                      >
                        <Globe className="h-2.5 w-2.5" strokeWidth={2} />
                        público
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-tiny text-text-muted tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
                      {t.dayCount} dia{t.dayCount === 1 ? "" : "s"} ·{" "}
                      {t.mealCount} refeições
                    </span>
                    {t.targetKcal != null && (
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3 w-3" strokeWidth={1.75} />
                        {t.targetKcal} kcal
                      </span>
                    )}
                    {t.usageCount > 0 && <span>· {t.usageCount}× usado</span>}
                  </span>
                  {t.description && (
                    <span className="mt-0.5 block truncate text-tiny text-text-muted">
                      {t.description}
                    </span>
                  )}
                </button>
                {!t.isPublic && (
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    disabled={isDeleting && deletingId === t.id}
                    title="Excluir modelo"
                    aria-label={`Excluir modelo "${t.name}"`}
                    className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger disabled:opacity-50"
                  >
                    {isDeleting && deletingId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </div>

              {isSelected && (
                <div className="border-t border-border-subtle p-2.5">
                  <label
                    htmlFor={`tpl-name-${t.id}`}
                    className="block text-tiny font-medium text-text-secondary"
                  >
                    Nome do novo plano
                  </label>
                  <input
                    id={`tpl-name-${t.id}`}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    maxLength={120}
                    disabled={isApplying}
                    className="mt-1 w-full rounded border border-border-default bg-bg-surface px-2.5 py-1.5 text-tiny text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                  />
                  {error && (
                    <p className="mt-1 text-tiny text-danger">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleApply(t.id)}
                    disabled={isApplying}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Criando plano…
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Criar plano a partir deste modelo
                      </>
                    )}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
