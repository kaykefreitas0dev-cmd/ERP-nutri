"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, LayoutTemplate, ChevronRight } from "lucide-react";
import {
  createMealPlanAction,
  listPlanTemplatesAction,
  createPlanFromTemplateAction,
} from "./actions";
import type { TemplatePickerItem } from "./actions";

type Mode = "blank" | "template";

export function NewMealPlanForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("blank");

  // Template picker state — null means "not yet fetched", [] means "fetched but empty"
  const [templates, setTemplates] = useState<TemplatePickerItem[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplatePickerItem | null>(null);
  const fetchStarted = useRef(false);

  // Load templates on first switch to template mode (fetch once)
  useEffect(() => {
    if (mode !== "template" || fetchStarted.current) return;
    fetchStarted.current = true;
    listPlanTemplatesAction().then((res) => {
      setTemplates(res.templates ?? []);
    });
  }, [mode]);

  async function handleBlankSubmit(formData: FormData) {
    setError(null);
    formData.set("patientId", patientId);
    startTransition(async () => {
      const result = await createMealPlanAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      router.push(`/app/patients/${patientId}/meal-plans/${result.mealPlanId}`);
    });
  }

  async function handleTemplateSubmit(formData: FormData) {
    setError(null);
    if (!selectedTemplate) {
      setError("Selecione um modelo antes de continuar");
      return;
    }
    formData.set("patientId", patientId);
    formData.set("templateId", selectedTemplate.id);
    startTransition(async () => {
      const result = await createPlanFromTemplateAction(formData);
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
      <div className="mt-3 flex rounded-md border border-border-subtle p-0.5 text-tiny">
        <button
          type="button"
          onClick={() => {
            setMode("blank");
            setSelectedTemplate(null);
            setError(null);
          }}
          className={
            "flex-1 rounded px-3 py-1.5 font-medium transition-colors " +
            (mode === "blank"
              ? "bg-brand-primary text-white"
              : "text-text-secondary hover:text-text-primary")
          }
        >
          Em branco
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("template");
            setError(null);
          }}
          className={
            "flex flex-1 items-center justify-center gap-1 rounded px-3 py-1.5 font-medium transition-colors " +
            (mode === "template"
              ? "bg-brand-primary text-white"
              : "text-text-secondary hover:text-text-primary")
          }
        >
          <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
          De um modelo
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-danger-bg p-3 text-body text-danger"
        >
          {error}
        </div>
      )}

      {/* ── BLANK MODE ── */}
      {mode === "blank" && (
        <form action={handleBlankSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="name" className="block text-tiny font-medium">
              Nome do plano *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Ex: Plano semanal março"
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
            />
          </div>

          <div>
            <label htmlFor="targetKcal" className="block text-tiny font-medium">
              Meta kcal/dia (opcional)
            </label>
            <input
              id="targetKcal"
              name="targetKcal"
              type="number"
              min="600"
              max="6000"
              placeholder="Ex: 2000"
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
            />
          </div>

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
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
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
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? "Criando…" : "Criar plano"}
          </button>

          <p className="inline-flex items-start gap-1 text-tiny text-text-muted">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
            Cria com 1 dia padrão e 6 refeições (café, lanches, almoço, jantar,
            ceia). Personalize depois.
          </p>
        </form>
      )}

      {/* ── TEMPLATE MODE ── */}
      {mode === "template" && (
        <form action={handleTemplateSubmit} className="mt-4 space-y-3">
          {/* Template picker */}
          <div>
            <label className="block text-tiny font-medium">Modelo *</label>

            {templates === null ? (
              <p className="mt-2 text-caption text-text-muted">
                Carregando modelos…
              </p>
            ) : templates.length === 0 ? (
              <p className="mt-2 text-caption text-text-muted">
                Nenhum modelo salvo. Abra um plano e clique em{" "}
                <strong className="font-medium">Salvar como modelo</strong>.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(t)}
                      className={
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-caption transition-colors " +
                        (selectedTemplate?.id === t.id
                          ? "border-brand-primary bg-brand-primary-bg text-text-primary"
                          : "border-border-subtle bg-bg-surface text-text-secondary hover:border-border-default hover:text-text-primary")
                      }
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-medium">
                          {t.name}
                        </span>
                        <span className="flex items-center gap-2 text-tiny text-text-muted">
                          {t.dayCount > 0 && (
                            <span>
                              {t.dayCount} {t.dayCount === 1 ? "dia" : "dias"}
                            </span>
                          )}
                          {t.totalKcal != null && (
                            <span className="tabular-nums">
                              {t.totalKcal.toLocaleString("pt-BR")} kcal/dia
                            </span>
                          )}
                          {t.usageCount > 0 && (
                            <span>usado {t.usageCount}×</span>
                          )}
                        </span>
                      </div>
                      <ChevronRight
                        className={
                          "h-4 w-4 shrink-0 transition-colors " +
                          (selectedTemplate?.id === t.id
                            ? "text-brand-primary"
                            : "text-text-muted")
                        }
                        strokeWidth={1.75}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Plan name — pre-filled from selected template, user can edit */}
          <div>
            <label htmlFor="tmpl-name" className="block text-tiny font-medium">
              Nome do plano *
            </label>
            {/*
              key resets the uncontrolled input when the selected template changes,
              letting defaultValue pre-fill while still allowing the user to type.
            */}
            <input
              key={selectedTemplate?.id ?? "no-template"}
              id="tmpl-name"
              name="name"
              type="text"
              required
              defaultValue={selectedTemplate?.name ?? ""}
              placeholder="Selecione um modelo acima"
              disabled={!selectedTemplate}
              className={
                "mt-1 block w-full rounded-md border px-3 py-2 text-body " +
                (selectedTemplate
                  ? "border-border-default"
                  : "border-border-subtle bg-bg-subtle text-text-muted")
              }
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="tmpl-start"
                className="block text-tiny font-medium"
              >
                Início
              </label>
              <input
                id="tmpl-start"
                name="startDate"
                type="date"
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
            <div>
              <label htmlFor="tmpl-end" className="block text-tiny font-medium">
                Fim
              </label>
              <input
                id="tmpl-end"
                name="endDate"
                type="date"
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !selectedTemplate}
            className="w-full rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? "Criando…" : "Criar a partir do modelo"}
          </button>
        </form>
      )}
    </div>
  );
}
