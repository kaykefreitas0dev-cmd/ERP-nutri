import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Home,
  CircleCheck,
  Utensils,
  Calendar,
  FileText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

const NAV_ITEMS: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/app", label: "Início", Icon: Home },
  { href: "/app/checkin", label: "Check-in", Icon: CircleCheck },
  { href: "/app/meu-plano", label: "Plano", Icon: Utensils },
  { href: "/app/consultas", label: "Consultas", Icon: Calendar },
  { href: "/app/documentos", label: "Docs", Icon: FileText },
  { href: "/app/pagamentos", label: "Pagto", Icon: Wallet },
];

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
    <div className="flex min-h-screen flex-col bg-bg-page">
      {/* Topbar (sticky, glassmorphism) */}
      <header className="sticky top-0 z-sticky border-b border-border-subtle glass px-5 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-2 text-h3 font-semibold text-brand-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11z"
                fill="currentColor"
                fillOpacity="0.12"
              />
              <path
                d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M9 16V9.5l6 6V8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            NutriCore
          </Link>
          <div className="flex items-center gap-3 text-tiny">
            <span className="hidden text-text-muted sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom nav (fixed) */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-fixed border-t border-border-subtle glass px-1 py-1.5"
      >
        <div className="mx-auto flex max-w-3xl justify-around">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-text-secondary transition-colors duration-fast hover:bg-bg-subtle hover:text-text-primary active:scale-[0.96]"
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
