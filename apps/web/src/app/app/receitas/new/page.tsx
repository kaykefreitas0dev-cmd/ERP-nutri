import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createRecipeAction } from "../actions";

export const metadata = { title: "Nova receita" };

/**
 * Server-rendered create form. On submit, the server action creates the
 * recipe and redirects to the detail page. No client JS needed.
 */
export default function NewReceitaPage() {
  async function handleCreate(formData: FormData) {
    "use server";
    const result = await createRecipeAction(formData);
    if (result.ok && result.recipeId) {
      redirect(`/app/receitas/${result.recipeId}`);
    }
    // On error we fall through — in practice Zod validation messages are
    // shown via the error state returned; for MVP redirect back to list.
    redirect("/app/receitas?error=create");
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/app/receitas"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Receitas
        </Link>

        <h1 className="mt-3 text-h1 font-semibold tracking-tight text-text-primary">
          Nova receita
        </h1>
        <p className="mt-1 text-caption text-text-secondary">
          Após criar, você poderá adicionar os ingredientes.
        </p>

        <form action={handleCreate} className="mt-8 space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-body font-medium text-text-primary"
            >
              Nome da receita <span className="text-danger">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="Ex: Salada de frango grelhado"
              className="mt-1.5 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-body font-medium text-text-primary"
            >
              Descrição{" "}
              <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
              placeholder="Breve descrição da receita..."
              className="mt-1.5 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
            />
          </div>

          {/* Servings + Prep time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="servings"
                className="block text-body font-medium text-text-primary"
              >
                Porções
              </label>
              <input
                id="servings"
                name="servings"
                type="number"
                min={1}
                max={100}
                defaultValue={1}
                className="mt-1.5 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body tabular-nums focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label
                htmlFor="prepTimeMinutes"
                className="block text-body font-medium text-text-primary"
              >
                Tempo de preparo{" "}
                <span className="text-text-muted font-normal">(min)</span>
              </label>
              <input
                id="prepTimeMinutes"
                name="prepTimeMinutes"
                type="number"
                min={1}
                max={600}
                placeholder="30"
                className="mt-1.5 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body tabular-nums placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block text-body font-medium text-text-primary"
            >
              Observações{" "}
              <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder="Modo de preparo, dicas, substituições..."
              className="mt-1.5 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="rounded-md bg-brand-primary px-6 py-2 text-body font-medium text-white transition-colors hover:bg-brand-primary-hover"
            >
              Criar receita
            </button>
            <Link
              href="/app/receitas"
              className="rounded-md px-4 py-2 text-body text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
