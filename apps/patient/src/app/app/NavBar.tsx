"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CircleCheck,
  Utensils,
  Calendar,
  FileText,
  Scale,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/app", label: "Início", Icon: Home },
  { href: "/app/checkin", label: "Check-in", Icon: CircleCheck },
  { href: "/app/meu-plano", label: "Plano", Icon: Utensils },
  { href: "/app/consultas", label: "Consultas", Icon: Calendar },
  { href: "/app/documentos", label: "Docs", Icon: FileText },
  { href: "/app/progresso", label: "Progresso", Icon: Scale },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-fixed border-t border-border-subtle glass px-1 py-1.5"
    >
      <div className="mx-auto flex max-w-3xl justify-around">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          // Exact match for home; prefix match for others
          const isActive =
            href === "/app" ? pathname === "/app" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={
                "flex min-w-[56px] flex-col items-center gap-0.5 rounded-md px-2 py-1 transition-colors duration-fast active:scale-[0.96] " +
                (isActive
                  ? "text-brand-primary"
                  : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary")
              }
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={isActive ? 2 : 1.75}
                aria-hidden="true"
              />
              <span
                className={
                  "text-[10px] font-medium " + (isActive ? "font-semibold" : "")
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
