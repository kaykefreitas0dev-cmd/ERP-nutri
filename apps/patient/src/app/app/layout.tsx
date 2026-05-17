import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Home,
  CircleCheck,
  Utensils,
  Calendar,
  FileText,
  Wallet,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-subtle bg-white px-5 py-3 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/app" className="text-lg font-bold text-brand-primary">
            NutriCore
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-muted">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="sticky bottom-0 border-t border-border-subtle bg-white px-1 py-2">
        <div className="mx-auto flex max-w-3xl justify-around text-[10px]">
          <Link
            href="/app"
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary hover:bg-bg-subtle"
          >
            <Home className="h-5 w-5" strokeWidth={1.75} />
            <span>Início</span>
          </Link>
          <Link
            href="/app/checkin"
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary hover:bg-bg-subtle"
          >
            <CircleCheck className="h-5 w-5" strokeWidth={1.75} />
            <span>Check-in</span>
          </Link>
          <Link
            href="/app/meu-plano"
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary hover:bg-bg-subtle"
          >
            <Utensils className="h-5 w-5" strokeWidth={1.75} />
            <span>Plano</span>
          </Link>
          <Link
            href="/app/consultas"
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary hover:bg-bg-subtle"
          >
            <Calendar className="h-5 w-5" strokeWidth={1.75} />
            <span>Consultas</span>
          </Link>
          <Link
            href="/app/documentos"
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary hover:bg-bg-subtle"
          >
            <FileText className="h-5 w-5" strokeWidth={1.75} />
            <span>Docs</span>
          </Link>
          <Link
            href="/app/pagamentos"
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary hover:bg-bg-subtle"
          >
            <Wallet className="h-5 w-5" strokeWidth={1.75} />
            <span>Pagto</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
