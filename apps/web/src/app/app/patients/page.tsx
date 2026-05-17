import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Archive } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pacientes" };

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function PatientsListPage({ searchParams }: Props) {
  const { q, status } = await searchParams;

  let patients: Array<{
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    status: string;
    updatedAt: Date;
  }> = [];

  try {
    patients = await withTenantAction(async ({ tx }) => {
      return tx.patient.findMany({
        where: {
          status: (status as "ACTIVE" | "ARCHIVED" | "ANONYMIZED") ?? "ACTIVE",
          ...(q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          updatedAt: true,
        },
      });
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
            <p className="mt-1 text-sm text-slate-600">
              {patients.length}{" "}
              {status === "ARCHIVED"
                ? "arquivados"
                : status === "ANONYMIZED"
                  ? "anonimizados (LGPD)"
                  : "ativos"}
            </p>
          </div>
          <Link
            href="/app/patients/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary-hover"
          >
            + Novo paciente
          </Link>
        </header>

        <form className="mb-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nome ou email..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          <select
            name="status"
            defaultValue={status ?? "ACTIVE"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ACTIVE">Ativos</option>
            <option value="ARCHIVED">Arquivados</option>
            <option value="ANONYMIZED">Anonimizados (LGPD)</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Filtrar
          </button>
        </form>

        {patients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-600">
              {q
                ? "Nenhum paciente encontrado para essa busca."
                : "Você ainda não tem pacientes."}
            </p>
            {!q && (
              <Link
                href="/app/patients/new"
                className="mt-4 inline-block text-sm text-brand-primary underline"
              >
                Cadastrar o primeiro
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Atualizado
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/patients/${p.id}`}
                        className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-brand-primary"
                      >
                        {p.status === "ANONYMIZED" && (
                          <Lock
                            className="h-3.5 w-3.5 text-slate-500"
                            strokeWidth={2}
                          />
                        )}
                        {p.status === "ARCHIVED" && (
                          <Archive
                            className="h-3.5 w-3.5 text-slate-500"
                            strokeWidth={2}
                          />
                        )}
                        {p.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {p.email && <div>{p.email}</div>}
                      {p.phone && <div className="text-xs">{p.phone}</div>}
                      {!p.email && !p.phone && (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/patients/${p.id}`}
                        className="text-xs text-brand-primary hover:underline"
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
