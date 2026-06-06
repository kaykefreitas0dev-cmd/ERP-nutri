"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate,
  Globe,
  Lock,
  Trash2,
  Loader2,
  Target,
  CalendarDays,
} from "lucide-react";
import {
  togglePublicTemplateAction,
  deleteTemplateAction,
  type TemplateSummary,
} from "../patients/[id]/meal-plans/template-actions";

export function TemplateManagerCard({
  template,
}: {
  template: TemplateSummary;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(template.isPublic);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    setError(null);
    startTransition(async () => {
      const result = await togglePublicTemplateAction({
        templateId: template.id,
        isPublic: next,
      });
      if (!result.ok) {
        setIsPublic(!next);
        setError(result.message ?? "Erro");
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir o modelo "${template.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTemplateAction({ templateId: template.id });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao excluir");
      }
    });
  }

  return (
    <li className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary">
          <LayoutTemplate className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body font-semibold text-text-primary">
              {template.name}
            </h3>
            {isPublic && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-bg-subtle px-1.5 py-0.5 text-tiny text-text-muted ring-1 ring-inset ring-border-subtle">
                <Globe className="h-2.5 w-2.5" strokeWidth={2} />
                público
              </span>
            )}
          </div>
          {template.description && (
            <p className="mt-0.5 text-tiny text-text-muted">
              {template.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-tiny text-text-muted tabular-nums">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
              {template.dayCount} dia{template.dayCount === 1 ? "" : "s"} ·{" "}
              {template.mealCount} refeições
            </span>
            {template.targetKcal != null && (
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3" strokeWidth={1.75} />
                {template.targetKcal} kcal
              </span>
            )}
            {template.usageCount > 0 && (
              <span>· {template.usageCount}× usado</span>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-tiny text-danger">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
        <button
          type="button"
          onClick={handleTogglePublic}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-tiny font-medium text-text-secondary transition-colors hover:bg-bg-subtle disabled:opacity-50"
          title={
            isPublic
              ? "Tornar privado (somente sua organização)"
              : "Tornar público (compartilhar com todas as organizações)"
          }
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : isPublic ? (
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
          ) : (
            <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {isPublic ? "Tornar privado" : "Tornar público"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded p-1 text-text-muted transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger disabled:opacity-50"
          title="Excluir modelo"
          aria-label={`Excluir modelo "${template.name}"`}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}
