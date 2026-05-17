import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { LayoutContentArea } from "@/components/layout/LayoutContentArea";
import { NpsWidget } from "./nps/NpsWidget";

/**
 * Layout autenticado /app/* — sidebar + topbar shell + content area.
 *
 * O layout NÃO wraps children em <main> nem força max-width — cada página
 * decide sua própria estrutura interna (alguns querem max-w-3xl, outros
 * max-w-6xl, etc.). Apenas provê:
 *   - Sidebar fixed left (240/64 colapsada)
 *   - Topbar sticky com glassmorphism (h-14)
 *   - CommandPalette portal (Cmd+K)
 *   - NpsWidget portal (floating bottom-right)
 *
 * Children podem reusar `<main className="min-h-screen ...">` ou qualquer
 * estrutura — o LayoutContentArea reage ao collapsed state da sidebar via
 * padding-left dinâmico.
 */
export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-page">
      <Sidebar />
      <LayoutContentArea>
        <Topbar />
        {children}
      </LayoutContentArea>
      <CommandPalette />
      <NpsWidget />
    </div>
  );
}
