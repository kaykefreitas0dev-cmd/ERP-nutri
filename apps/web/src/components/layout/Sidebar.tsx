"use client";

import { useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserPlus,
  UtensilsCrossed,
  BookOpen,
  Download,
  Wallet,
  Settings,
  PanelLeft,
} from "lucide-react";
import { NutricoreLogoFull, NutricoreLogoMark } from "./Logo";
import { SidebarItem, SidebarSection } from "./SidebarItem";
import { useSidebarStore } from "./sidebar-store";

/**
 * Sidebar — espinha dorsal do portal nutricionista.
 *
 * 240px expandida / 64px colapsada. Transição via CSS data-attribute.
 * Atalho `[` toggle global.
 *
 * Seções organizadas por frequência de uso (spec §V.2).
 */
export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

  // Atalho global `[` para toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignora se foco em input/textarea/contenteditable
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      ) {
        return;
      }
      if (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <aside
      data-collapsed={collapsed}
      style={{ width: collapsed ? "64px" : "240px" }}
      className={
        "fixed left-0 top-0 z-fixed h-screen border-r border-border-subtle bg-bg-surface " +
        "flex flex-col transition-[width] duration-slow " +
        "[transition-timing-function:var(--ease-out-expo)]"
      }
    >
      {/* Header — logo + toggle */}
      <div className="flex h-14 items-center justify-between border-b border-border-subtle px-3">
        {collapsed ? (
          <NutricoreLogoMark className="h-7 w-7 text-brand-primary" />
        ) : (
          <NutricoreLogoFull className="h-7 w-auto text-brand-primary" />
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Colapsar sidebar"
            title="Colapsar (atalho: [)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Nav scrollable */}
      <nav
        aria-label="Navegação principal"
        className="flex-1 overflow-y-auto pb-4"
      >
        <SidebarSection title="Hoje" />
        <SidebarItem
          href="/app"
          label="Dashboard"
          Icon={LayoutDashboard}
          exact
        />
        <SidebarItem href="/app/agenda" label="Agenda" Icon={Calendar} />

        <SidebarSection title="Pacientes" />
        <SidebarItem href="/app/patients" label="Lista" Icon={Users} exact />
        <SidebarItem
          href="/app/patients/new"
          label="Novo paciente"
          Icon={UserPlus}
        />

        <SidebarSection title="Ferramentas" />
        <SidebarItem
          href="/app/alimentos"
          label="Alimentos"
          Icon={UtensilsCrossed}
        />
        <SidebarItem href="/app/receitas" label="Receitas" Icon={BookOpen} />
        <SidebarItem
          href="/app/imports"
          label="Importar pacientes"
          Icon={Download}
        />

        <SidebarSection title="Configurações" />
        <SidebarItem href="/app/financeiro" label="Financeiro" Icon={Wallet} />
        <SidebarItem
          href="/app/settings"
          label="Configurações"
          Icon={Settings}
        />
      </nav>

      {/* Footer — toggle quando colapsada */}
      {collapsed && (
        <div className="border-t border-border-subtle p-2">
          <button
            type="button"
            onClick={toggle}
            aria-label="Expandir sidebar"
            title="Expandir (atalho: [)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
          >
            <PanelLeft className="h-4 w-4 rotate-180" strokeWidth={1.75} />
          </button>
        </div>
      )}
    </aside>
  );
}
