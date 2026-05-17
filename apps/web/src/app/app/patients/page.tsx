import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  Search,
  Lock,
  Archive,
  Eye,
  Calendar,
  MoreHorizontal,
  Users,
  ArrowRight,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { Avatar } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import { StatusDot } from "@repo/ui/status-dot";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pacientes" };

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

type PatientStatus = "ACTIVE" | "ARCHIVED" | "ANONYMIZED";

interface PatientRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  updatedAt: Date;
}

function statusInfo(status: string): {
  variant: "success" | "neutral" | "warning";
  dot: "active" | "inactive" | "warning";
  label: string;
} {
  if (status === "ACTIVE")
    return { variant: "success", dot: "active", label: "Ativo" };
  if (status === "ARCHIVED")
    return { variant: "neutral", dot: "inactive", label: "Arquivado" };
  return { variant: "warning", dot: "warning", label: "Anonimizado" };
}

function timeSince(date: Date): string {
  const now = Date.now();
  const then = date.getTime();
  const diffMs = now - then;
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}mês atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

export default async function PatientsListPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const filterStatus = (status as PatientStatus) ?? "ACTIVE";

  let result: {
    patients: PatientRow[];
    counts: { active: number; archived: number; anonymized: number };
  } = {
    patients: [],
    counts: { active: 0, archived: 0, anonymized: 0 },
  };

  try {
    result = await withTenantAction(async ({ tx }) => {
      const [patients, [active, archived, anonymized]] = await Promise.all([
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
          take: 50,
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
      return {
        patients,
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

        {/* Empty state */}
        {result.patients.length === 0 ? (
          <EmptyState query={q} filterStatus={filterStatus} />
        ) : (
          <PatientsTable patients={result.patients} />
        )}
      </div>
    </main>
  );
}

function PatientsTable({ patients }: { patients: PatientRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
      <table className="min-w-full">
        <thead className="border-b border-border-subtle bg-bg-subtle/50">
          <tr>
            <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Paciente
            </th>
            <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Contato
            </th>
            <th className="hidden px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted md:table-cell">
              Status
            </th>
            <th className="hidden px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted md:table-cell">
              Atualizado
            </th>
            <th className="px-5 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {patients.map((p) => {
            const info = statusInfo(p.status);
            return (
              <tr
                key={p.id}
                className="group cursor-pointer transition-colors duration-fast hover:bg-bg-subtle/40"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/app/patients/${p.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar name={p.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-body font-medium text-text-primary group-hover:text-brand-primary">
                        {p.status === "ANONYMIZED" && (
                          <Lock
                            className="h-3 w-3 shrink-0 text-text-muted"
                            strokeWidth={2}
                          />
                        )}
                        {p.status === "ARCHIVED" && (
                          <Archive
                            className="h-3 w-3 shrink-0 text-text-muted"
                            strokeWidth={2}
                          />
                        )}
                        {p.fullName}
                      </p>
                      <p className="md:hidden mt-0.5 text-tiny text-text-muted tabular-nums">
                        {timeSince(p.updatedAt)}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-3 text-caption text-text-secondary">
                  {p.email ? <div className="truncate">{p.email}</div> : null}
                  {p.phone ? (
                    <div className="truncate text-tiny text-text-muted tabular-nums">
                      {p.phone}
                    </div>
                  ) : null}
                  {!p.email && !p.phone && (
                    <span className="text-text-subtle">—</span>
                  )}
                </td>
                <td className="hidden px-5 py-3 md:table-cell">
                  <Badge
                    variant={info.variant}
                    leftIcon={
                      <StatusDot
                        status={info.dot}
                        pulse={p.status === "ACTIVE"}
                        size={1.5}
                      />
                    }
                  >
                    {info.label}
                  </Badge>
                </td>
                <td className="hidden px-5 py-3 text-caption text-text-muted tabular-nums md:table-cell">
                  {timeSince(p.updatedAt)}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                    <Link
                      href={`/app/patients/${p.id}`}
                      aria-label="Ver prontuário"
                      title="Ver prontuário"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Link>
                    <Link
                      href="/app/agenda"
                      aria-label="Agendar consulta"
                      title="Agendar consulta"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
                    >
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Link>
                    <button
                      type="button"
                      aria-label="Mais opções"
                      title="Mais opções"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
                    >
                      <MoreHorizontal
                        className="h-3.5 w-3.5"
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
