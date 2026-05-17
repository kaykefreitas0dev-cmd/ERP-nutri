"use client";

import { type ReactNode } from "react";
import { useSidebarStore } from "./sidebar-store";

/**
 * LayoutContentArea — wrapper que reage ao estado collapsed da sidebar.
 *
 * Ajusta o padding-left dinamicamente (240px ou 64px) e usa transição
 * suave com easing custom.
 */
export function LayoutContentArea({ children }: { children: ReactNode }) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  return (
    <div
      style={{ paddingLeft: collapsed ? "64px" : "240px" }}
      className="min-h-screen transition-[padding] duration-slow [transition-timing-function:var(--ease-out-expo)]"
    >
      {children}
    </div>
  );
}
