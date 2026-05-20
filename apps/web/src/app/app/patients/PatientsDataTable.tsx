"use client";

import {
  useRef,
  useState,
  useTransition,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import Link from "next/link";
import {
  Lock,
  Archive,
  Eye,
  Calendar,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type FilterFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Avatar } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import { StatusDot } from "@repo/ui/status-dot";
import { fetchPatientsPage, type PatientRow } from "./actions";

/* ── helpers ────────────────────────────────────────────────────── */

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
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}mês atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

/* ── column helper + fuzzy filter ────────────────────────────────── */

const columnHelper = createColumnHelper<PatientRow>();

const ROW_HEIGHT = 56; // px — must match the tr height via className

/** Client-side fuzzy filter: matches name OR email (case-insensitive, accent-folded) */
const patientGlobalFilter: FilterFn<PatientRow> = (
  row,
  _colId,
  value: string,
) => {
  if (!value) return true;
  const term = value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const name = row.original.fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const email = (row.original.email ?? "").toLowerCase();
  return name.includes(term) || email.includes(term);
};

/* ── component ──────────────────────────────────────────────────── */

interface Props {
  initialPatients: PatientRow[];
  initialCursor: string | null;
  filterStatus: string;
  query: string | undefined;
}

export function PatientsDataTable({
  initialPatients,
  initialCursor,
  filterStatus,
  query,
}: Props) {
  const [patients, setPatients] = useState<PatientRow[]>(initialPatients);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Sync patients when server re-fetches (status/query change from URL)
  useEffect(() => {
    setPatients(initialPatients);
    setNextCursor(initialCursor);
    setGlobalFilter("");
  }, [initialPatients, initialCursor]);

  /* ── column definitions ─────────────────────────────────────── */

  const columns = useMemo(
    () => [
      columnHelper.accessor("fullName", {
        header: "Paciente",
        cell: (info) => {
          const row = info.row.original;
          return (
            <Link
              href={`/app/patients/${row.id}`}
              className="flex items-center gap-3 group/cell"
            >
              <Avatar name={row.fullName} size="sm" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-body font-medium text-text-primary group-hover/cell:text-brand-primary">
                  {row.status === "ANONYMIZED" && (
                    <Lock
                      className="h-3 w-3 shrink-0 text-text-muted"
                      strokeWidth={2}
                    />
                  )}
                  {row.status === "ARCHIVED" && (
                    <Archive
                      className="h-3 w-3 shrink-0 text-text-muted"
                      strokeWidth={2}
                    />
                  )}
                  {row.fullName}
                </p>
                <p className="md:hidden mt-0.5 text-tiny text-text-muted tabular-nums">
                  {timeSince(row.updatedAt)}
                </p>
              </div>
            </Link>
          );
        },
        size: 280,
        enableSorting: true,
      }),
      columnHelper.accessor("email", {
        header: "Contato",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="text-caption text-text-secondary">
              {row.email ? <div className="truncate">{row.email}</div> : null}
              {row.phone ? (
                <div className="truncate text-tiny text-text-muted tabular-nums">
                  {row.phone}
                </div>
              ) : null}
              {!row.email && !row.phone && (
                <span className="text-text-subtle">—</span>
              )}
            </div>
          );
        },
        size: 200,
        enableSorting: true,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const s = statusInfo(info.getValue());
          return (
            <Badge
              variant={s.variant}
              leftIcon={
                <StatusDot
                  status={s.dot}
                  pulse={info.getValue() === "ACTIVE"}
                  size={1.5}
                />
              }
            >
              {s.label}
            </Badge>
          );
        },
        size: 120,
        enableSorting: true,
        meta: { className: "hidden md:table-cell" },
      }),
      columnHelper.accessor("updatedAt", {
        header: "Atualizado",
        cell: (info) => (
          <span className="text-caption text-text-muted tabular-nums">
            {timeSince(info.getValue())}
          </span>
        ),
        size: 120,
        enableSorting: true,
        meta: { className: "hidden md:table-cell" },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
              <Link
                href={`/app/patients/${row.id}`}
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
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          );
        },
        size: 100,
        enableSorting: false,
      }),
    ],
    [],
  );

  /* ── table instance ─────────────────────────────────────────── */

  const table = useReactTable({
    data: patients,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: patientGlobalFilter,
    // Dates need special comparison (TanStack Table compares by default with </>)
    sortingFns: {
      auto: (rowA, rowB, colId) => {
        const a = rowA.getValue(colId);
        const b = rowB.getValue(colId);
        if (a instanceof Date && b instanceof Date) {
          return a.getTime() - b.getTime();
        }
        if (typeof a === "string" && typeof b === "string") {
          return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
        }
        return 0;
      },
    },
  });

  const { rows } = table.getRowModel();

  /* ── virtualizer ────────────────────────────────────────────── */

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  // Padding top/bottom so absolute positioned rows align correctly
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  /* ── load more ──────────────────────────────────────────────── */

  const loadMore = useCallback(() => {
    if (!nextCursor || isPending) return;
    startTransition(async () => {
      const res = await fetchPatientsPage({
        status: filterStatus,
        q: query,
        cursor: nextCursor,
      });
      if (res.ok && res.patients) {
        setPatients((prev) => [...prev, ...res.patients!]);
        setNextCursor(res.nextCursor ?? null);
      }
    });
  }, [nextCursor, isPending, filterStatus, query]);

  /* ── header sort icon ───────────────────────────────────────── */

  function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
    if (isSorted === "asc")
      return <ChevronUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />;
    if (isSorted === "desc")
      return <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />;
    return (
      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-30" strokeWidth={2} />
    );
  }

  /* ── render ─────────────────────────────────────────────────── */

  const filteredCount = table.getFilteredRowModel().rows.length;
  const showFilterNotice =
    globalFilter.length > 0 && filteredCount < patients.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Inline instant search (client-side, no server round-trip) */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filtrar por nome ou email na lista carregada…"
          aria-label="Filtrar pacientes carregados"
          className="h-9 w-full rounded-md border border-border-default bg-bg-surface pl-9 pr-8 text-body text-text-primary placeholder:text-text-muted transition-[border-color,box-shadow] duration-fast focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
        />
        {globalFilter && (
          <button
            type="button"
            onClick={() => setGlobalFilter("")}
            aria-label="Limpar filtro local"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Filter notice */}
      {showFilterNotice && (
        <p className="text-tiny text-text-muted">
          Mostrando{" "}
          <span className="font-medium text-text-secondary tabular-nums">
            {filteredCount}
          </span>{" "}
          de <span className="tabular-nums">{patients.length}</span> carregados
          para "<span className="italic">{globalFilter}</span>". Para busca no
          banco,{" "}
          <a
            href={`/app/patients?q=${encodeURIComponent(globalFilter)}`}
            className="text-text-link underline-offset-2 hover:underline"
          >
            use o filtro acima
          </a>
          .
        </p>
      )}

      {/* Scrollable virtualized table */}
      <div
        ref={parentRef}
        className="overflow-auto rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]"
        style={{ maxHeight: "min(calc(100vh - 400px), 600px)", minHeight: 200 }}
        role="region"
        aria-label="Lista de pacientes"
      >
        <table className="min-w-full">
          <thead className="sticky top-0 z-10 border-b border-border-subtle bg-bg-subtle/95 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | { className?: string }
                    | undefined;
                  return (
                    <th
                      key={header.id}
                      className={[
                        "px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted",
                        header.column.getCanSort()
                          ? "cursor-pointer select-none hover:text-text-secondary"
                          : "",
                        meta?.className ?? "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getCanSort() && (
                            <SortIcon isSorted={header.column.getIsSorted()} />
                          )}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {/* Top spacer for virtual scroll */}
            {paddingTop > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: paddingTop }} />
              </tr>
            )}

            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="group cursor-pointer border-b border-border-subtle/60 transition-colors duration-fast last:border-b-0 hover:bg-bg-subtle/40"
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | { className?: string }
                      | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={["px-5 py-3", meta?.className ?? ""]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Bottom spacer */}
            {paddingBottom > 0 && (
              <tr aria-hidden>
                <td
                  colSpan={columns.length}
                  style={{ height: paddingBottom }}
                />
              </tr>
            )}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-16 text-center text-caption text-text-muted">
            Nenhum paciente encontrado.
          </div>
        )}
      </div>

      {/* Footer row: count + load more */}
      <div className="flex items-center justify-between px-1">
        <p className="text-tiny text-text-muted tabular-nums">
          {patients.length} paciente{patients.length !== 1 ? "s" : ""} carregado
          {patients.length !== 1 ? "s" : ""}
          {nextCursor && " (mais disponíveis)"}
        </p>

        {nextCursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-tiny font-medium text-text-secondary transition-all duration-fast hover:border-border-strong hover:bg-bg-surface-hover disabled:opacity-50 active:scale-[0.98]"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : null}
            Carregar mais
          </button>
        )}
      </div>
    </div>
  );
}
