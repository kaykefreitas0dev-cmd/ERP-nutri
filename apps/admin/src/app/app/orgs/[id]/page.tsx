import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@nutricore/db";
import { SuspendOrgButton } from "./SuspendOrgButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Organização" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrgDetailPage({ params }: Props) {
  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          patients: true,
          memberships: true,
          auditLogs: true,
        },
      },
    },
  });
  if (!org) notFound();

  const [memberships, recentPatients] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: id },
      include: {
        user: { select: { email: true, fullName: true } },
      },
      orderBy: { invitedAt: "asc" },
      take: 50,
    }),
    prisma.patient.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        fullName: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app/orgs" className="text-sm text-teal-700 hover:underline">
        ← Organizações
      </Link>

      <header className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
          <p className="text-xs text-slate-500">
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              {org.slug}
            </code>{" "}
            · Plano <strong>{org.plan}</strong> · Status{" "}
            <strong>{org.subscriptionStatus}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Criada em {new Date(org.createdAt).toLocaleDateString("pt-BR")} · ID{" "}
            <code className="font-mono text-[10px]">{org.id}</code>
          </p>
        </div>
        <SuspendOrgButton
          orgId={org.id}
          currentStatus={org.subscriptionStatus}
        />
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Pacientes" value={org._count.patients.toString()} />
        <Stat
          label="Membros (nutris)"
          value={org._count.memberships.toString()}
        />
        <Stat label="Audit entries" value={org._count.auditLogs.toString()} />
      </section>

      {/* Memberships */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold">
            Membros ({memberships.length})
          </h2>
        </header>
        {memberships.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Sem membros.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberships.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{m.user.fullName ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {m.user.email ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">{m.role}</td>
                  <td className="px-4 py-2 text-xs">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pacientes recentes */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold">
            Pacientes recentes ({recentPatients.length})
          </h2>
        </header>
        {recentPatients.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Sem pacientes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentPatients.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-5 py-2 text-sm"
              >
                <span>
                  {p.fullName}
                  <span className="ml-2 text-xs text-slate-500">
                    ({p.status})
                  </span>
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
