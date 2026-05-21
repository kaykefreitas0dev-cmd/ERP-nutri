"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { createCustomFoodAction } from "./actions";

export function NewCustomFoodForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await createCustomFoodAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      formRef.current?.reset();
      // Keep form open so user can add more foods
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-brand-primary-hover"
      >
        {open ? (
          <>
            <X className="h-4 w-4" strokeWidth={2} />
            Cancelar
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Alimento personalizado
          </>
        )}
        {!open && (
          <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className="mt-4 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
          <h2 className="text-h3 font-semibold text-text-primary">
            Novo alimento personalizado
          </h2>
          <p className="mt-0.5 text-caption text-text-muted">
            Valores nutricionais por 100g. Aparecerá na busca de alimentos em
            planos.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-body text-danger"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="mt-3 rounded-md bg-success-bg px-3 py-2 text-body text-success"
            >
              Alimento criado com sucesso!
            </div>
          )}

          <form ref={formRef} action={handleSubmit} className="mt-4 space-y-4">
            {/* Name + Brand */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cf-name"
                  className="block text-tiny font-medium text-text-primary"
                >
                  Nome *
                </label>
                <input
                  id="cf-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="Ex: Whey Protein isolado"
                  disabled={pending}
                  className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="cf-brand"
                  className="block text-tiny font-medium text-text-primary"
                >
                  Marca (opcional)
                </label>
                <input
                  id="cf-brand"
                  name="brand"
                  type="text"
                  maxLength={80}
                  placeholder="Ex: Optimum Nutrition"
                  disabled={pending}
                  className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="cf-category"
                className="block text-tiny font-medium text-text-primary"
              >
                Categoria (opcional)
              </label>
              <input
                id="cf-category"
                name="category"
                type="text"
                maxLength={60}
                placeholder="Ex: Suplemento, Laticínio, Fruta"
                disabled={pending}
                className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
              />
            </div>

            {/* Macros grid */}
            <div>
              <p className="mb-2 text-tiny font-medium text-text-primary">
                Valores por 100g
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <MacroField
                  id="cf-kcal"
                  name="kcalPer100g"
                  label="kcal"
                  placeholder="0"
                  max={10000}
                  disabled={pending}
                />
                <MacroField
                  id="cf-protein"
                  name="proteinG"
                  label="Proteína (g)"
                  placeholder="0"
                  max={100}
                  disabled={pending}
                />
                <MacroField
                  id="cf-carb"
                  name="carbG"
                  label="Carboidrato (g)"
                  placeholder="0"
                  max={100}
                  disabled={pending}
                />
                <MacroField
                  id="cf-fat"
                  name="fatG"
                  label="Lipídeo (g)"
                  placeholder="0"
                  max={100}
                  disabled={pending}
                />
                <MacroField
                  id="cf-fiber"
                  name="fiberG"
                  label="Fibra (g)"
                  placeholder="0"
                  max={100}
                  disabled={pending}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-brand-primary px-5 py-2 text-body font-medium text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {pending ? "Salvando…" : "Salvar alimento"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setSuccess(false);
                }}
                disabled={pending}
                className="text-body text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MacroField({
  id,
  name,
  label,
  placeholder,
  max,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  max: number;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-tiny text-text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        min={0}
        max={max}
        step={0.1}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body tabular-nums placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
      />
    </div>
  );
}
