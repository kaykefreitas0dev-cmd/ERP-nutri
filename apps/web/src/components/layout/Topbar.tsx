"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, PanelLeft, Bell, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebarStore } from "./sidebar-store";
import { useCommandPaletteStore } from "./command-palette-store";

const ROUTE_LABELS: Record<string, string> = {
  app: "Dashboard",
  agenda: "Agenda",
  patients: "Pacientes",
  new: "Novo",
  alimentos: "Alimentos & Receitas",
  imports: "Importar",
  financeiro: "Financeiro",
  settings: "Configurações",
  anthropometry: "Antropometria",
  "meal-plans": "Planos alimentares",
  documents: "Documentos",
  checkins: "Check-ins",
  edit: "Editar",
  export: "Exportar",
  invites: "Convites",
  anonymize: "Anonimizar",
};

function humanizeSegment(segment: string): string {
  return ROUTE_LABELS[segment] ?? segment;
}

interface Crumb {
  label: string;
  href: string;
}

function buildBreadcrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  // /app is implicit (mostrado via logo no sidebar); só breadcrumbs >= 2 segmentos
  if (parts.length < 2) return [];

  const crumbs: Crumb[] = [];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += "/" + parts[i];
    // UUIDs / IDs longos: omite do breadcrumb (apenas labels semânticos)
    const seg = parts[i]!;
    if (seg.length > 16 && /^[a-f0-9-]+$/i.test(seg)) continue;
    crumbs.push({
      label: humanizeSegment(seg),
      href: acc,
    });
  }
  return crumbs;
}

/**
 * Topbar — sticky h-14, glassmorphism, command palette trigger central.
 *
 * Layout:
 *   [PanelLeft] [Breadcrumbs] ··· [Command trigger] ··· [Bell] [ThemeToggle] [User]
 */
export function Topbar() {
  const pathname = usePathname();
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const openPalette = useCommandPaletteStore((s) => s.setOpen);

  const crumbs = buildBreadcrumbs(pathname);

  return (
    <header
      className={
        "sticky top-0 z-sticky flex h-14 items-center gap-3 border-b border-border-subtle " +
        "glass px-4"
      }
    >
      {/* Esquerda — toggle sidebar + breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar (atalho: [)"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {crumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-1 text-caption text-text-secondary md:flex"
          >
            {crumbs.map((c, i) => (
              <span
                key={c.href}
                className="inline-flex min-w-0 items-center gap-1"
              >
                {i > 0 && (
                  <ChevronRight
                    className="h-3 w-3 shrink-0 text-text-subtle"
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
                {i === crumbs.length - 1 ? (
                  <span className="truncate font-medium text-text-primary">
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    className="truncate transition-colors hover:text-text-primary"
                  >
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Centro — Command Palette trigger */}
      <div className="mx-auto w-full max-w-[480px] flex-1">
        <button
          type="button"
          onClick={() => openPalette(true)}
          className={
            "group flex h-9 w-full items-center gap-2 rounded-sm border border-border-default " +
            "bg-bg-surface px-3 text-body text-text-muted transition-all duration-fast " +
            "hover:border-border-strong hover:bg-bg-surface-hover hover:text-text-secondary"
          }
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="flex-1 truncate text-left">
            Busque pacientes, receitas, alimentos...
          </span>
          <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border-subtle bg-bg-muted px-1.5 font-mono text-tiny font-medium text-text-muted">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Direita — Notifs + Theme + User */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Notificações"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {/* Dot de não-lida (placeholder — wire ao realtime depois) */}
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
