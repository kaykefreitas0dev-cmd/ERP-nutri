"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, BookMarked, ChevronDown, Flame, Layers } from "lucide-react";
import {
  createMealPlanAction,
  createMealPlanFromTemplateAction,
  listMealPlanTemplatesAction,
} from "./actions";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  targetKcal: string | null;
  usageCount: number;
  dayCount: number;
  totalKcal: number | null;
}

export function NewMealPlanForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Template mode
  const [mode, setMode] = useState<"blank" | "template">("blank");
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateOption | null>(null);

  async function loadTemplates() {
    if (templates !== null) return; // already loaded
    setLoadingTemplates(true);
    const result = await listMealPlanTemplatesAction();
    setLoadingTemplates(false);
    if (result.ok && result.templates) {
      setTemplates(result.templates);
    }
  }

  async function switchToTemplate() {
    setMode("template");
    await loadTemplates();
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("patientId", patientId);

    startTransition(async () => {
      let result;
      if (mode === "template" && selectedTemplate) {
        formData.set("templateId", selectedTemplate.id);
        result = await createMealPlanFromTemplateAction(formData);
      } else {
        result = await createMealPlanAction(formData);
      }

      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      router.push(`/app/patients/${patientId}/meal-plans/${result.mealPlanId}`);
    });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <h2 className="text-h3 font-semibold text-text-primary">
        Novo plano alimentar
      </h2>

      {/* Mode toggle */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("blank")}
          className={
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-tiny font-medium transition-colors " +
            (mode === "blank"
              ? "bg-brand-primary text-white"
              : "border border-border-default text-text-secondary hover:bg-bg-subtle")
          }
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
          Em branco
        </button>
        <button
          type="button"
          onClick={switchToTemplate}
          className={
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-tiny font-medium transition-colors " +
            (mode === "template"
              ? "bg-brand-primary text-white"
              : "border border-border-default text-text-secondary hover:bg-bg-subtle")
          }
        >
          <BookMarked className="h-3.5 w-3.5" strokeWidth={1.75} />
          De um modelo
        </button>
      </div>

      {/* Template picker */}
      {mode === "template" && (
        <div className="mt-3">
          {loadingTemplates ? (
            <p className="text-tiny text-text-muted">Carregando modelos…</p>
          ) : templates !== null && templates.length === 0 ? (
            <p className="text-tiny text-text-muted">
              Nenhum modelo salvo ainda. Abra um plano e clique em{" "}
              <strong>Salvar como modelo</strong>.
            </p>
          ) : templates !== null ? (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {templates.map((tpl) => {
                const selected = selectedTemplate?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(selected ? null : tpl)}
                    className={
                      "w-full rounded-md border p-2.5 text-left transition-all " +
                      (selected
                        ? "border-brand-primary bg-brand-primary-bg"
                        : "border-border-subtle hover:border-border-default hover:bg-bg-subtle")
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-caption font-medium text-text-primary leading-snug">
                        {tpl.name}
                      </p>
                      <div className="shrink-0 flex items-center gap-2 text-tiny tabular-nums text-text-muted">
                        {tpl.totalKcal && (
                          <span className="flex items-center gap-0.5">
                            <Flame
                              className="h-2.5 w-2.5 text-warning"
                              strokeWidth={1.75}
                            />
                            {tpl.totalKcal}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Layers className="h-2.5 w-2.5" strokeWidth={1.75} />
                          {tpl.dayCount}d
                        </span>
                        {tpl.usageCount > 0 && (
                          <span className="text-text-muted">
                            ×{tpl.usageCount}
                          </span>
                        )}
                      </div>
                    </div>
                    {tpl.description && (
                      <p className="mt-0.5 text-tiny text-text-muted line-clamp-1">
                        {tpl.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-danger-bg p-3 text-body text-danger"
        >
          {error}
        </div>
      )}

      <form action={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="name" className="block text-tiny font-medium">
            Nome do plano *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={
              selectedTemplate ? `${selectedTemplate.name} — cópia` : undefined
            }
            key={selectedTemplate?.id ?? "blank"}
            placeholder="Ex: Plano semanal março"
            className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label htmlFor="targetKcal" className="block text-tiny font-medium">
            Meta kcal/dia{" "}
            <span className="text-text-muted font-normal">(opcional)</span>
          </label>
          <input
            id="targetKcal"
            name="targetKcal"
            type="number"
            min="600"
            max="6000"
            defaultValue={
              selectedTemplate?.targetKcal
                ? Math.round(parseFloat(selectedTemplate.targetKcal))
                : undefined
            }
            key={`kcal-${selectedTemplate?.id ?? "blank"}`}
            placeholder="Ex: 2000"
            className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body tabular-nums focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        {/* Dates only shown for blank mode (templates carry their own structure) */}
        {mode === "blank" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="startDate"
                className="block text-tiny font-medium"
              >
                Início
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-tiny font-medium">
                Fim
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || (mode === "template" && !selectedTemplate)}
          className="w-full rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending
            ? "Criando…"
            : mode === "template" && selectedTemplate
              ? `Criar a partir de "${selectedTemplate.name}"`
              : "Criar plano"}
        </button>

        {mode === "blank" && (
          <p className="inline-flex items-start gap-1 text-tiny text-text-muted">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
            Cria com 1 dia padrão e 6 refeições (café, lanches, almoço, jantar,
            ceia). Personalize depois.
          </p>
        )}

        {mode === "template" && !selectedTemplate && (
          <p className="flex items-center gap-1 text-tiny text-text-muted">
            <ChevronDown className="h-3 w-3" strokeWidth={2} />
            Selecione um modelo acima para continuar.
          </p>
        )}
      </form>
    </div>
  );
}
