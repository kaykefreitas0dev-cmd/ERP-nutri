import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca de Alimentos" };

interface Props {
  searchParams: Promise<{ q?: string; category?: string; source?: string }>;
}

export default async function FoodsPage({ searchParams }: Props) {
  const { q, category, source } = await searchParams;

  let data: {
    foods: Array<{
      id: string;
      name: string;
      category: string | null;
      source: string;
      kcalPer100g: { toString: () => string } | null;
      proteinG: { toString: () => string } | null;
      carbG: { toString: () => string } | null;
      fatG: { toString: () => string } | null;
    }>;
    categories: string[];
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (q) {
        where.name = { contains: q, mode: "insensitive" };
      }
      if (category) {
        where.category = category;
      }
      if (source) {
        where.source = source;
      }

      const foods = await tx.food.findMany({
        where,
        orderBy: { name: "asc" },
        take: 100,
        select: {
          id: true,
          name: true,
          category: true,
          source: true,
          kcalPer100g: true,
          proteinG: true,
          carbG: true,
          fatG: true,
        },
      });

      // Buscar todas categorias para o filter
      const categoriesRaw = await tx.food.findMany({
        where: { isActive: true, category: { not: null } },
        select: { category: true },
        distinct: ["category"],
      });
      const categories = categoriesRaw
        .map((c: { category: string | null }) => c.category)
        .filter((c: string | null): c is string => c !== null)
        .sort();

      return { foods, categories };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) return null;

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Dashboard
          </Link>
          <h1 className="mt-3 text-h1 font-semibold tracking-tight text-text-primary">
            Biblioteca de Alimentos
          </h1>
          <p className="mt-1 text-caption text-text-secondary tabular-nums">
            {data.foods.length} alimentos · Fontes: TACO (UNICAMP), POF (IBGE),
            suas receitas
          </p>
        </header>

        <form className="mb-6 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar alimento..."
            className="flex-1 min-w-[200px] rounded-md border border-border-default bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-border-default bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas categorias</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={source ?? ""}
            className="rounded-md border border-border-default bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas fontes</option>
            <option value="TACO">TACO</option>
            <option value="POF">POF (IBGE)</option>
            <option value="USDA">USDA</option>
            <option value="CUSTOM">Minhas receitas</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
          >
            Filtrar
          </button>
        </form>

        {data.foods.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-12 text-center">
            <p className="text-text-secondary">Nenhum alimento encontrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-white shadow-sm">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-bg-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Alimento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                    kcal/100g
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                    PTN
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                    CHO
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                    LIP
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-muted">
                    Fonte
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.foods.map((f) => (
                  <tr key={f.id} className="hover:bg-bg-subtle">
                    <td className="px-4 py-2 text-sm font-medium text-text-primary">
                      {f.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-text-muted">
                      {f.category ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {f.kcalPer100g?.toString() ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {f.proteinG?.toString() ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {f.carbG?.toString() ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {f.fatG?.toString() ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.source === "TACO"
                            ? "bg-brand-100 text-brand-primary-hover"
                            : f.source === "POF"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-bg-muted text-text-secondary"
                        }`}
                      >
                        {f.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-text-muted">
          💡 Valores nutricionais por 100g de alimento. PTN=Proteína,
          CHO=Carboidrato, LIP=Lipídio.
        </p>
      </div>
    </main>
  );
}
