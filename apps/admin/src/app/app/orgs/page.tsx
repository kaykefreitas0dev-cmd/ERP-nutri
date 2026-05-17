import Link from "next/link";
import { prisma } from "@nutricore/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Organizações" };

const STATUS_STYLE: Record<string, string> = {
  TRIALING: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-red-100 text-red-800",
  CANCELLED: "bg-bg-muted text-text-secondary",
};

export default async function AdminOrgsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      createdAt: true,
      _count: { select: { patients: true, memberships: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Organizações</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {orgs.length} org(s) cadastrada(s) na plataforma
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle bg-bg-subtle text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Pacientes</th>
              <th className="px-4 py-3 text-right">Membros</th>
              <th className="px-4 py-3 text-left">Criada</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {orgs.map((o) => (
              <tr key={o.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-2 font-medium text-text-primary">
                  {o.name}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-text-secondary">
                  {o.slug}
                </td>
                <td className="px-4 py-2 text-xs">{o.plan}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      STATUS_STYLE[o.subscriptionStatus] ??
                      "bg-bg-subtle text-text-secondary"
                    }`}
                  >
                    {o.subscriptionStatus}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {o._count.patients}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {o._count.memberships}
                </td>
                <td className="px-4 py-2 text-xs text-text-muted">
                  {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/app/orgs/${o.id}`}
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
    </div>
  );
}
