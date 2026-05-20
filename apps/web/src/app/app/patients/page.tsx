import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, Lock, Archive, Users, ArrowRight } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { PatientsDataTable } from "./PatientsDataTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pacientes" };

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

type PatientStatus = "ACTIVE" | "ARCHIVED" | "ANONYMIZED";

export default async function PatientsListPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const filterStatus = (status as PatientStatus) ?? "ACTIVE";

  let result: {
    patients: {
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      status: string;
      updatedAt: Date;
    }[];
    nextCursor: string | null;
    counts: { active: number; archived: number; anonymized: number };
  } = {
    patients: [],
    nextCursor: null,
    counts: { active: 0, archived: 0, anonymized: 0 },
  };

  try {
    result = await withTenantAction(async ({ tx }) => {
      const PAGE_SIZE = 100;
      const [rawPatients, [active, archived, anonymized]] = await Promise.all([
        tx.patient.findMany({
          where: {
            status: filterStatus,
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
          take: PAGE_SIZE + 1, // +1 to detect next page
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            updatedAt: true,
          },
        }),
        Promise.all([
          tx.patient.count({ where: { status: "ACTIVE" } }),
          tx.patient.count({ where: { status: "ARCHIVED" } }),
          tx.patient.count({ where: { status: "ANONYMIZED" } }),
        ]),
      ]);

      let nextCursor: string | null = null;
      if (rawPatients.length > PAGE_SIZE) {
        rawPatients.pop();
        nextCursor = rawPatients[rawPatients.length - 1]?.id ?? null;
      }

      return {
        patients: rawPatients,
        nextCursor,
        counts: { active, archived, anonymized },
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
              Pacientes
            </h1>
            <p className="mt-1 text-caption text-text-secondary tabular-nums">
              {result.counts.active} ativos · {result.counts.archived}{" "}
              arquivados
              {result.counts.anonymized > 0 && (
                <> · {result.counts.anonymized} anonimizados</>
              )}
            </p>
          </div>
          <Link
            href="/app/patients/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-base [transition-timing-function:var(--ease-out-expo)] hover:bg-brand-primary-hover hover:[box-shadow:var(--shadow-md)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Novo paciente
          </Link>
        </header>

        {/* Filtros */}
        <form className="mb-6 flex flex-wrap items-center gap-2" role="search">
          <div className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nome, email..."
              className="flex-1 h-9 w-full rounded-sm border border-border-default bg-bg-surface pl-9 pr-3 text-body text-text-primary placeholder:text-text-muted transition-[border-color,box-shadow] duration-fast focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
            />
          </div>
          <select
            name="status"
            defaultValue={filterStatus}
            className="h-9 rounded-sm border border-border-default bg-bg-surface px-3 text-body text-text-primary transition-colors hover:border-border-strong focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
          >
            <option value="ACTIVE">Ativos</option>
            <option value="ARCHIVED">Arquivados</option>
            <option value="ANONYMIZED">Anonimizados (LGPD)</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border-default bg-bg-surface px-4 text-body font-medium text-text-primary transition-all duration-fast hover:bg-bg-surface-hover hover:border-border-strong active:scale-[0.98]"
          >
            Filtrar
          </button>
          {(q || filterStatus !== "ACTIVE") && (
            <Link
              href="/app/patients"
              className="text-caption text-text-secondary underline-offset-2 transition-colors hover:text-text-primary hover:underline"
            >
              Limpar
            </Link>
          )}
        </form>

        {/* Empty state or table */}
        {result.patients.length === 0 ? (
          <EmptyState query={q} filterStatus={filterStatus} />
        ) : (
          <PatientsDataTable
            initialPatients={result.patients}
            initialCursor={result.nextCursor}
            filterStatus={filterStatus}
            query={q}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState({
  query,
  filterStatus,
}: {
  query?: string;
  filterStatus: PatientStatus;
}) {
  if (query) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <Search className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-h3 font-semibold text-text-primary">
          Nenhum paciente encontrado
        </h2>
        <p className="mt-1 text-caption text-text-secondary">
          Tente buscar por outro termo ou{" "}
          <Link
            href="/app/patients"
            className="text-text-link underline-offset-2 hover:underline"
          >
            limpe os filtros
          </Link>
          .
        </p>
      </div>
    );
  }

  if (filterStatus === "ARCHIVED") {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <Archive className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-h3 font-semibold text-text-primary">
          Nenhum paciente arquivado
        </h2>
        <p className="mt-1 text-caption text-text-secondary">
          Pacientes inativos aparecem aqui quando você arquiva no prontuário.
        </p>
      </div>
    );
  }

  if (filterStatus === "ANONYMIZED") {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <Lock className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-h3 font-semibold text-text-primary">
          Nenhum paciente anonimizado
        </h2>
        <p className="mt-1 text-caption text-text-secondary">
          Anonimizações por LGPD (Art. 18) aparecem aqui mantendo apenas o
          histórico clínico anônimo conforme Lei 13.787/CFN 599.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary-bg text-brand-primary">
        <Users className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <h2 className="mt-4 text-h2 font-semibold text-text-primary">
        Você ainda não tem pacientes
      </h2>
      <p className="mx-auto mt-2 max-w-md text-caption text-text-secondary">
        Cadastre seu primeiro paciente para começar a montar planos alimentares,
        agendar consultas e acompanhar a evolução. Tudo isolado por organização
        (RLS).
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/app/patients/new"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-base hover:bg-brand-primary-hover hover:[box-shadow:var(--shadow-md)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Cadastrar o primeiro
        </Link>
        <Link
          href="/app/imports"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-4 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover"
        >
          ou importar de planilha
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
