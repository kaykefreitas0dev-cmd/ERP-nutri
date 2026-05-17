import { prisma } from "@nutricore/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Usuários" };

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      status: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
        <p className="mt-1 text-sm text-slate-600">
          {users.length} user(s) — busca limitada a 100 resultados
        </p>
      </header>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por email ou nome..."
          className="block w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Memberships</th>
              <th className="px-4 py-3 text-left">Criado</th>
              <th className="px-4 py-3 text-left">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{u.email ?? "—"}</td>
                <td className="px-4 py-2">{u.fullName ?? "—"}</td>
                <td className="px-4 py-2 text-center text-xs">{u.status}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {u._count.memberships}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">
                  {u.id.slice(0, 8)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
