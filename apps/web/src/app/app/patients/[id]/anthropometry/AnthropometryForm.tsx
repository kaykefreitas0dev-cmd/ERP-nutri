"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAnthropometryAction } from "./actions";

interface Props {
  patientId: string;
  patientSex: string | null;
  patientBirthDate: Date | string | null;
}

export function AnthropometryForm({ patientId, patientSex }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<
    "pollock_3" | "pollock_7" | "manual_bia"
  >("pollock_3");

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      formData.set("patientId", patientId);
      formData.set("protocol", protocol);
      const result = await createAnthropometryAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="mt-4 space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-md bg-danger-bg p-3 text-body text-danger"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="measuredAt" className="block text-tiny font-medium">
            Data da medição
          </label>
          <input
            id="measuredAt"
            name="measuredAt"
            type="datetime-local"
            defaultValue={new Date()
              .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
              .slice(0, 16)
              .replace(" ", "T")}
            className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label htmlFor="protocol" className="block text-tiny font-medium">
            Protocolo
          </label>
          <select
            id="protocol"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as typeof protocol)}
            className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
          >
            <option value="pollock_3">Pollock 3 dobras</option>
            <option value="pollock_7">Pollock 7 dobras</option>
            <option value="manual_bia">Bioimpedância (manual)</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-body font-semibold text-text-primary">
          Medidas básicas
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="weightKg" className="block text-tiny font-medium">
              Peso (kg)
            </label>
            <input
              id="weightKg"
              name="weightKg"
              type="number"
              step="0.1"
              min="0"
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              placeholder="70.5"
            />
          </div>
          <div>
            <label htmlFor="heightCm" className="block text-tiny font-medium">
              Altura (cm)
            </label>
            <input
              id="heightCm"
              name="heightCm"
              type="number"
              step="0.1"
              min="0"
              className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              placeholder="170"
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-body font-semibold text-text-primary">
          Circunferências (cm)
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <input
            name="waist"
            type="number"
            step="0.1"
            placeholder="Cintura"
            className="rounded-md border border-border-default px-3 py-2 text-body"
          />
          <input
            name="hip"
            type="number"
            step="0.1"
            placeholder="Quadril"
            className="rounded-md border border-border-default px-3 py-2 text-body"
          />
          <input
            name="abdomen"
            type="number"
            step="0.1"
            placeholder="Abdômen"
            className="rounded-md border border-border-default px-3 py-2 text-body"
          />
        </div>
      </fieldset>

      {protocol === "pollock_3" && (
        <fieldset>
          <legend className="text-body font-semibold text-text-primary">
            Dobras Pollock 3 (mm) - {patientSex === "male" ? "Homem" : "Mulher"}
          </legend>
          {patientSex === "male" ? (
            <div className="mt-2 grid grid-cols-3 gap-3">
              <input
                name="chest"
                type="number"
                step="0.1"
                placeholder="Peitoral"
                className="rounded-md border border-border-default px-3 py-2 text-body"
              />
              <input
                name="abdominal"
                type="number"
                step="0.1"
                placeholder="Abdominal"
                className="rounded-md border border-border-default px-3 py-2 text-body"
              />
              <input
                name="thigh"
                type="number"
                step="0.1"
                placeholder="Coxa"
                className="rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-3">
              <input
                name="triceps"
                type="number"
                step="0.1"
                placeholder="Tricipital"
                className="rounded-md border border-border-default px-3 py-2 text-body"
              />
              <input
                name="suprailiac"
                type="number"
                step="0.1"
                placeholder="Supra-ilíaca"
                className="rounded-md border border-border-default px-3 py-2 text-body"
              />
              <input
                name="thigh"
                type="number"
                step="0.1"
                placeholder="Coxa"
                className="rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
          )}
        </fieldset>
      )}

      {protocol === "pollock_7" && (
        <fieldset>
          <legend className="text-body font-semibold text-text-primary">
            Dobras Pollock 7 (mm)
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["chest", "Peitoral"],
              ["midaxillary", "Axilar M."],
              ["triceps", "Tricipital"],
              ["subscapular", "Subescapular"],
              ["abdominal", "Abdominal"],
              ["suprailiac", "Supra-ilíaca"],
              ["thigh", "Coxa"],
            ].map(([n, l]) => (
              <input
                key={n}
                name={n}
                type="number"
                step="0.1"
                placeholder={l}
                className="rounded-md border border-border-default px-2 py-2 text-body"
              />
            ))}
          </div>
        </fieldset>
      )}

      {protocol === "manual_bia" && (
        <fieldset>
          <legend className="text-body font-semibold text-text-primary">
            Bioimpedância
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="biaBodyFatPct"
                className="block text-tiny font-medium"
              >
                %GC (BIA)
              </label>
              <input
                id="biaBodyFatPct"
                name="biaBodyFatPct"
                type="number"
                step="0.1"
                min="0"
                max="80"
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
            <div>
              <label
                htmlFor="biaLeanMassKg"
                className="block text-tiny font-medium"
              >
                Massa magra (kg)
              </label>
              <input
                id="biaLeanMassKg"
                name="biaLeanMassKg"
                type="number"
                step="0.1"
                min="0"
                className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
              />
            </div>
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="notes" className="block text-tiny font-medium">
          Observações
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
      >
        {pending ? "Calculando + salvando…" : "Salvar medição"}
      </button>

      <p className="text-tiny text-text-muted">
        💡 IMC, GEB (Mifflin/Harris/FAO) e %GC (Pollock) são calculados
        automaticamente usando idade + sexo do paciente.
      </p>
    </form>
  );
}
