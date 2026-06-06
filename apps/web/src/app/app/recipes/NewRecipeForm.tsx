"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Plus } from "lucide-react";
import { createRecipeAction } from "./actions";

export function NewRecipeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [prep, setPrep] = useState("");
  const [description, setDescription] = useState("");

  const inputCls =
    "mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Dê um nome à receita (mín. 2 caracteres)");
      return;
    }
    startTransition(async () => {
      const result = await createRecipeAction({
        name: name.trim(),
        description: description.trim() || undefined,
        servings: Number(servings) || 1,
        prepTimeMinutes: prep ? Number(prep) : undefined,
      });
      if (result.ok && result.recipeId) {
        router.push(`/app/recipes/${result.recipeId}`);
      } else {
        setError(result.message ?? "Erro ao criar receita");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <h2 className="flex items-center gap-1.5 text-h3 font-semibold text-text-primary">
        <ChefHat className="h-4 w-4 text-brand-primary" strokeWidth={1.75} />
        Nova receita
      </h2>
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-danger-bg p-3 text-body text-danger"
        >
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="r-name" className="block text-tiny font-medium">
            Nome *
          </label>
          <input
            id="r-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
            required
            placeholder="Ex: Panqueca de banana"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="r-servings" className="block text-tiny font-medium">
              Porções
            </label>
            <input
              id="r-servings"
              type="number"
              min="1"
              max="100"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="r-prep" className="block text-tiny font-medium">
              Preparo (min)
            </label>
            <input
              id="r-prep"
              type="number"
              min="0"
              max="1440"
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              placeholder="ex: 15"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label htmlFor="r-desc" className="block text-tiny font-medium">
            Descrição (opcional)
          </label>
          <textarea
            id="r-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Modo de preparo, observações…"
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {pending ? "Criando…" : "Criar e adicionar ingredientes"}
        </button>
      </form>
    </div>
  );
}
