import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * Global store da sidebar. Persiste em localStorage para preservar entre
 * sessões. Default expandida (240px).
 */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: "nutricore.sidebar.v1",
      // Re-hidrata só do client (evita hydration mismatch)
      skipHydration: false,
    },
  ),
);
