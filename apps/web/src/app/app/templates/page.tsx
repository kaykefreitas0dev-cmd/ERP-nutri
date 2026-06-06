import { LayoutTemplate, Globe, Target, CalendarDays } from "lucide-react";
import { listTemplatesAction } from "../patients/[id]/meal-plans/template-actions";
import { TemplateManagerCard } from "./TemplateManagerCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos de plano alimentar" };

export default async function TemplatesPage() {
  const templates = await listTemplatesAction();
  const own = templates.filter((t) => t.isOwn);
  const shared = templates.filter((t) => !t.isOwn && t.isPublic);

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header>
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Ferramentas
          </p>
          <h1 className="mt-0.5 flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
            <LayoutTemplate
              className="h-6 w-6 text-text-secondary"
              strokeWidth={1.75}
            />
            Modelos de plano
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Reutilize estruturas de planos alimentares. Salve um plano como
            modelo na página de planos de um paciente; aplique-os ao criar novos
            planos. Modelos públicos ficam disponíveis para todas as
            organizações.
          </p>
        </header>

        <section className="mt-8">
          <h2 className="mb-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Seus modelos ({own.length})
          </h2>
          {own.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
                <LayoutTemplate className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="mt-3 text-h3 font-semibold text-text-primary">
                Nenhum modelo ainda
              </p>
              <p className="mt-1 text-caption text-text-secondary">
                Abra um plano alimentar de um paciente e use “Salvar como
                modelo” para criar o primeiro.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {own.map((t) => (
                <TemplateManagerCard key={t.id} template={t} />
              ))}
            </ul>
          )}
        </section>

        {shared.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
              <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
              Modelos públicos ({shared.length})
            </h2>
            <ul className="space-y-2.5">
              {shared.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-subtle/40 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-text-muted">
                    <LayoutTemplate className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-body font-semibold text-text-primary">
                      {t.name}
                    </h3>
                    {t.description && (
                      <p className="mt-0.5 text-tiny text-text-muted">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-tiny text-text-muted tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
                        {t.dayCount} dia{t.dayCount === 1 ? "" : "s"} ·{" "}
                        {t.mealCount} refeições
                      </span>
                      {t.targetKcal != null && (
                        <span className="inline-flex items-center gap-1">
                          <Target className="h-3 w-3" strokeWidth={1.75} />
                          {t.targetKcal} kcal
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
