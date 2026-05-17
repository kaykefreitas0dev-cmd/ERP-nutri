import { prisma } from "@nutricore/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Audit log" };

interface Props {
  searchParams: Promise<{ action?: string; org?: string; limit?: string }>;
}

interface AuditRow {
  id: string;
  organization_id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  patient_id: string | null;
  fields_accessed: string[];
  log_hash: string;
  created_at: Date;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const { action, org, limit } = await searchParams;
  const lim = Math.min(parseInt(limit ?? "100", 10) || 100, 500);

  // Raw SQL pra ter controle preciso de filtros + audit schema
  const where: string[] = [];
  const params: unknown[] = [];
  if (action) {
    params.push(`%${action}%`);
    where.push(`action ILIKE $${params.length}`);
  }
  if (org) {
    params.push(org);
    where.push(`organization_id = $${params.length}::uuid`);
  }
  params.push(lim);
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await prisma.$queryRawUnsafe<AuditRow[]>(
    `SELECT id, organization_id, actor_user_id, actor_role, action,
            entity_type, entity_id, patient_id, fields_accessed,
            log_hash, created_at
     FROM audit.audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    ...params,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600">
          {rows.length} entrada(s) — Merkle-style hash chain (mostra 8 chars
          finais do hash pra verificação)
        </p>
      </header>

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          name="action"
          defaultValue={action ?? ""}
          placeholder="Filtrar action (ex: patient.create)"
          className="flex-1 min-w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="org"
          defaultValue={org ?? ""}
          placeholder="Org ID (UUID)"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
        />
        <select
          name="limit"
          defaultValue={limit ?? "100"}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="500">500</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Quando</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Entity</th>
              <th className="px-3 py-2 text-left">Actor role</th>
              <th className="px-3 py-2 text-left">Org</th>
              <th className="px-3 py-2 text-left">Fields</th>
              <th className="px-3 py-2 text-left">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-[10px] text-slate-500">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2 font-mono">{r.action}</td>
                <td className="px-3 py-2 text-[11px]">
                  {r.entity_type}
                  {r.entity_id && (
                    <span className="ml-1 text-slate-500">
                      ({r.entity_id.toString().slice(0, 8)}...)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px]">{r.actor_role}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                  {r.organization_id.slice(0, 8)}...
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-600">
                  {r.fields_accessed?.join(", ") ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                  ...{r.log_hash.slice(-8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-5 text-center text-sm text-slate-500">
            Nenhuma entrada (ajuste os filtros).
          </p>
        )}
      </div>
    </div>
  );
}
