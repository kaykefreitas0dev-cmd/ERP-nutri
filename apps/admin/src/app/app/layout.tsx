import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileSearch,
  Users,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check super_admin role no JWT (raw_app_meta_data.is_super_admin)
  const isSuperAdmin = Boolean(
    (user.app_metadata as Record<string, unknown> | undefined)?.[
      "is_super_admin"
    ],
  );

  if (!isSuperAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <ShieldAlert
            className="mx-auto h-10 w-10 text-red-600"
            strokeWidth={1.75}
          />
          <h1 className="mt-3 text-lg font-bold text-red-900">Acesso negado</h1>
          <p className="mt-2 text-sm text-red-700">
            Você não tem permissão de super-admin. Esta área é restrita ao
            backoffice da plataforma.
          </p>
          <form action="/api/auth/signout" method="POST" className="mt-4">
            <button
              type="submit"
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Sair
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border-subtle bg-text-primary text-bg-page">
        <div className="border-b border-border-default px-5 py-4">
          <Link href="/app" className="text-lg font-bold text-white">
            NutriCore Admin
          </Link>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-subtle">
            Backoffice
          </p>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 text-sm">
          <NavLink href="/app" Icon={LayoutDashboard}>
            Dashboard
          </NavLink>
          <NavLink href="/app/orgs" Icon={Building2}>
            Organizações
          </NavLink>
          <NavLink href="/app/users" Icon={Users}>
            Usuários
          </NavLink>
          <NavLink href="/app/nps" Icon={MessageSquare}>
            NPS beta
          </NavLink>
          <NavLink href="/app/audit" Icon={FileSearch}>
            Audit log
          </NavLink>
        </nav>
        <div className="absolute bottom-0 w-56 border-t border-border-default p-3">
          <p className="text-[10px] text-text-muted">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-bg-subtle p-6">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  Icon,
  children,
}: {
  href: string;
  Icon: typeof LayoutDashboard;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-text-subtle hover:bg-text-primary hover:text-white"
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      <span>{children}</span>
    </Link>
  );
}
