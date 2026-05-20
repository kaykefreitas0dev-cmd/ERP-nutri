"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createMealPlanAction } from "./actions";

export function NewMealPlanForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
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

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <h2 className="text-h3 font-semibold text-text-primary">
        Novo plano alimentar
      </h2>

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
            <label htmlFor="startDate" className="block text-tiny font-medium">
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
    </div>
  );
}
