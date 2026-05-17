import Link from "next/link";
import { redirect } from "next/navigation";
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
    if (err instanceof ActionTenantError && err.code === "NO_ORG") redirect("/onboarding");
    throw err;
  }

  if (!data) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <Link href="/app" className="text-sm text-teal-700 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Biblioteca de Alimentos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.foods.length} alimentos • Fontes: TACO (UNICAMP), POF (IBGE), suas receitas
          </p>
        </header>

        <form className="mb-6 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar alimento..."
            className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas fontes</option>
            <option value="TACO">TACO</option>
            <option value="POF">POF (IBGE)</option>
            <option value="USDA">USDA</option>
            <option value="CUSTOM">Minhas receitas</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Filtrar
          </button>
        </form>

        {data.foods.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-600">Nenhum alimento encontrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Alimento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    kcal/100g
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    PTN
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    CHO
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    LIP
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                    Fonte
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.foods.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm font-medium text-slate-900">
                      {f.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
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
                            ? "bg-teal-100 text-teal-800"
                            : f.source === "POF"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200 text-slate-700"
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

        <p className="mt-4 text-xs text-slate-500">
          💡 Valores nutricionais por 100g de alimento. PTN=Proteína, CHO=Carboidrato, LIP=Lipídio.
        </p>
      </div>
    </main>
  );
}
