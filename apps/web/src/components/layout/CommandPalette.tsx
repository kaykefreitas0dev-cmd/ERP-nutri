"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  Search,
  LayoutDashboard,
  Calendar,
  Users,
  UserPlus,
  UtensilsCrossed,
  Download,
  Wallet,
  Settings,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { useCommandPaletteStore } from "./command-palette-store";

interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  Icon: LucideIcon;
  shortcut?: string;
  group: "Navegar" | "Ações rápidas";
  run: (router: ReturnType<typeof useRouter>) => void;
}

const ACTIONS: CommandAction[] = [
  // Navegar
  {
    id: "nav-dashboard",
    label: "Ir para Dashboard",
    Icon: LayoutDashboard,
    group: "Navegar",
    run: (router) => router.push("/app"),
  },
  {
    id: "nav-agenda",
    label: "Abrir Agenda",
    Icon: Calendar,
    group: "Navegar",
    run: (router) => router.push("/app/agenda"),
  },
  {
    id: "nav-patients",
    label: "Lista de pacientes",
    Icon: Users,
    group: "Navegar",
    run: (router) => router.push("/app/patients"),
  },
  {
    id: "nav-foods",
    label: "Alimentos & Receitas",
    Icon: UtensilsCrossed,
    group: "Navegar",
    run: (router) => router.push("/app/alimentos"),
  },
  {
    id: "nav-financeiro",
    label: "Financeiro",
    Icon: Wallet,
    group: "Navegar",
    run: (router) => router.push("/app/financeiro"),
  },
  {
    id: "nav-imports",
    label: "Importar pacientes",
    Icon: Download,
    group: "Navegar",
    run: (router) => router.push("/app/imports"),
  },
  {
    id: "nav-settings",
    label: "Configurações da organização",
    Icon: Settings,
    group: "Navegar",
    run: (router) => router.push("/app/settings"),
  },
  // Ações rápidas
  {
    id: "new-patient",
    label: "Cadastrar novo paciente",
    Icon: UserPlus,
    shortcut: "N P",
    group: "Ações rápidas",
    run: (router) => router.push("/app/patients/new"),
  },
  {
    id: "new-appointment",
    label: "Agendar nova consulta",
    Icon: Calendar,
    shortcut: "N C",
    group: "Ações rápidas",
    run: (router) => router.push("/app/agenda?action=new"),
  },
  {
    id: "import-csv",
    label: "Importar CSV de pacientes",
    Icon: FileText,
    group: "Ações rápidas",
    run: (router) => router.push("/app/imports"),
  },
];

/**
 * CommandPalette — Cmd/Ctrl+K abre overlay com fuzzy search.
 *
 * Stack:
 *  - Radix Dialog → portal + focus trap + overlay + escape
 *  - cmdk → fuzzy search + keyboard nav + grouping
 */
export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Atalho global Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const runAction = useCallback(
    (action: CommandAction) => {
      action.run(router);
      setOpen(false);
      setSearch("");
    },
    [router, setOpen],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-modal-backdrop bg-bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          style={{ zIndex: 70 }}
        />
        <Dialog.Content
          className={
            "fixed left-1/2 top-[20%] z-modal w-[90vw] max-w-[640px] -translate-x-1/2 " +
            "rounded-xl border border-border-subtle bg-bg-surface " +
            "[box-shadow:var(--shadow-xl)] " +
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 " +
            "data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-4"
          }
          style={{ zIndex: 80 }}
        >
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Busque pacientes, navegue entre páginas ou execute ações rápidas.
          </Dialog.Description>

          <Command
            label="Command Menu"
            shouldFilter
            filter={(value, search) => {
              if (value.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <div className="flex items-center gap-3 border-b border-border-subtle px-4">
              <Search
                className="h-5 w-5 shrink-0 text-text-muted"
                strokeWidth={1.75}
                aria-hidden
              />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Busque ações, páginas, pacientes..."
                className="h-12 w-full bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="hidden h-5 items-center rounded border border-border-subtle bg-bg-muted px-1.5 font-mono text-tiny font-medium text-text-muted sm:inline-flex">
                esc
              </kbd>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-caption text-text-muted">
                Nenhum resultado para &ldquo;{search}&rdquo;.
              </Command.Empty>

              {(["Ações rápidas", "Navegar"] as const).map((groupName) => {
                const items = ACTIONS.filter((a) => a.group === groupName);
                return (
                  <Command.Group key={groupName} heading={groupName}>
                    <div className="px-2 pb-1 pt-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      {groupName}
                    </div>
                    {items.map((action) => (
                      <Command.Item
                        key={action.id}
                        value={action.label + " " + (action.hint ?? "")}
                        onSelect={() => runAction(action)}
                        className={
                          "flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 " +
                          "text-body text-text-primary " +
                          "data-[selected=true]:bg-bg-subtle " +
                          "data-[selected=true]:ring-1 data-[selected=true]:ring-border-subtle"
                        }
                      >
                        <action.Icon
                          className="h-4 w-4 shrink-0 text-text-muted"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <span className="flex-1 truncate">{action.label}</span>
                        {action.shortcut && (
                          <kbd className="inline-flex h-5 items-center rounded border border-border-subtle bg-bg-muted px-1.5 font-mono text-tiny font-medium text-text-muted">
                            {action.shortcut}
                          </kbd>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>

            <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2 text-tiny text-text-muted">
              <span className="hidden items-center gap-2 sm:inline-flex">
                <kbd className="rounded border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono">
                  ↑↓
                </kbd>
                Navegar
                <span className="opacity-50">·</span>
                <kbd className="rounded border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono">
                  ⏎
                </kbd>
                Selecionar
              </span>
              <span className="opacity-60">
                Pressione{" "}
                <kbd className="rounded border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono">
                  ⌘K
                </kbd>{" "}
                em qualquer lugar
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
