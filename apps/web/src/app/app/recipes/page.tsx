import Link from "next/link";
import { redirect } from "next/navigation";
import { ChefHat, Flame, Utensils, ChevronRight } from "lucide-react";
import { SectionHeader } from "@repo/ui/section-header";
import { ActionTenantError } from "@/lib/with-tenant-action";
import { listRecipesAction } from "./actions";
import { NewRecipeForm } from "./NewRecipeForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receitas" };

export default async function RecipesPage() {
  let recipes;
  try {
    recipes = await listRecipesAction();
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          as="h1"
          label="Biblioteca"
          title={
            <span className="inline-flex items-center gap-2">
              <ChefHat
                className="h-6 w-6 text-text-secondary"
                strokeWidth={1.75}
              />
              Receitas
            </span>
          }
          description="Crie receitas reutilizáveis com ingredientes da biblioteca de alimentos. Os macros são calculados automaticamente."
        />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {recipes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
                  <ChefHat className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-h3 font-semibold text-text-primary">
                  Nenhuma receita ainda
                </p>
                <p className="mt-1 text-caption text-text-secondary">
                  Crie a primeira receita usando o formulário ao lado.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {recipes.map((r) => (
                  <li
                    key={r.id}
                    className="group rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)] transition-all hover:[box-shadow:var(--shadow-sm)]"
                  >
                    <Link
                      href={`/app/recipes/${r.id}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-body font-semibold text-text-primary transition-colors group-hover:text-brand-primary">
                          {r.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-tiny text-text-muted tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Utensils className="h-3 w-3" strokeWidth={1.75} />
                            {r.ingredientCount} ingrediente
                            {r.ingredientCount === 1 ? "" : "s"} · {r.servings}{" "}
                            porç{r.servings === 1 ? "ão" : "ões"}
                          </span>
                          {r.perServingKcal != null && (
                            <span className="inline-flex items-center gap-1">
                              <Flame className="h-3 w-3" strokeWidth={1.75} />
                              {r.perServingKcal} kcal/porção
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-text-muted"
                        strokeWidth={2}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <NewRecipeForm />
          </div>
        </div>
      </div>
    </main>
  );
}
