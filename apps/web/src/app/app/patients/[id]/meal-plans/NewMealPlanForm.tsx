"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Novo plano alimentar
      </h2>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form action={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="name" className="block text-xs font-medium">
            Nome do plano *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ex: Plano semanal março"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="targetKcal" className="block text-xs font-medium">
            Meta kcal/dia (opcional)
          </label>
          <input
            id="targetKcal"
            name="targetKcal"
            type="number"
            min="600"
            max="6000"
            placeholder="Ex: 2000"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="startDate" className="block text-xs font-medium">
              Início
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-xs font-medium">
              Fim
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Criando…" : "Criar plano"}
        </button>

        <p className="text-xs text-slate-500">
          ✨ Cria com 1 dia padrão e 6 refeições (café, lanches, almoço, jantar,
          ceia). Personalize depois.
        </p>
      </form>
    </div>
  );
}
