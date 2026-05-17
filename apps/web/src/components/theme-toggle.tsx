"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

/**
 * ThemeToggle — cicla light → dark → system → light.
 *
 * Usa useSyncExternalStore + subscribe noop pra detectar montagem do client
 * sem disparar setState dentro de useEffect (regra react-hooks/set-state-in-effect
 * do React 19).
 */
function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {}, // subscribe noop — só queremos getSnapshot rodar client-side
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  function cycle() {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }

  // SSR: placeholder pra preservar layout (evita CLS)
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Trocar tema"
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted " +
          className
        }
      >
        <Sun className="h-4 w-4" strokeWidth={1.75} />
      </button>
    );
  }

  const label =
    theme === "system"
      ? `Tema: automático (${resolvedTheme})`
      : `Tema: ${theme === "dark" ? "escuro" : "claro"}`;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-fast hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 " +
        className
      }
    >
      {theme === "light" && <Sun className="h-4 w-4" strokeWidth={1.75} />}
      {theme === "dark" && <Moon className="h-4 w-4" strokeWidth={1.75} />}
      {theme === "system" && <Monitor className="h-4 w-4" strokeWidth={1.75} />}
    </button>
  );
}
