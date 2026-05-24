"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  User,
  Loader2,
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

interface PatientHit {
  id: string;
  fullName: string;
  email: string | null;
}

/**
 * CommandPalette — Cmd/Ctrl+K abre overlay com fuzzy search.
 *
 * Stack:
 *  - Radix Dialog → portal + focus trap + overlay + escape
 *  - cmdk → keyboard nav + grouping (shouldFilter=false; filtramos manualmente)
 *
 * Patient search:
 *  - Debounce 300ms quando search.length >= 2
 *  - Fetch GET /api/v1/patients?q=...&limit=5&status=ACTIVE
 *  - AbortController cancela requests obsoletos
 */
export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientHit[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

  // Patient search com debounce 300ms
  // Quando search < 2 o grupo de pacientes fica oculto via showPatients=false;
  // não precisamos de setState síncrono no efeito para limpar.
  useEffect(() => {
    if (search.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoadingPatients(true);
      try {
        const res = await fetch(
          `/api/v1/patients?q=${encodeURIComponent(search)}&limit=5&status=ACTIVE`,
          { signal: abortRef.current.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: PatientHit[] };
        setPatients(data.items ?? []);
      } catch {
        // AbortError esperado em digitação rápida; outros erros ignorados silenciosamente
      } finally {
        setLoadingPatients(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const runAction = useCallback(
    (action: CommandAction) => {
      action.run(router);
      setOpen(false);
      setSearch("");
    },
    [router, setOpen],
  );

  const goToPatient = useCallback(
    (patientId: string) => {
      router.push(`/app/patients/${patientId}`);
      setOpen(false);
      setSearch("");
    },
    [router, setOpen],
  );

  // Filtragem manual dos itens estáticos (shouldFilter=false no Command)
  const q = search.toLowerCase();
  const filteredActions = ACTIONS.filter(
    (a) =>
      !q ||
      a.label.toLowerCase().includes(q) ||
      (a.hint ?? "").toLowerCase().includes(q),
  );
  const navActions = filteredActions.filter((a) => a.group === "Navegar");
  const quickActions = filteredActions.filter(
    (a) => a.group === "Ações rápidas",
  );

  const showPatients = search.length >= 2;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        // Limpa estado local quando fecha (sem useEffect para evitar cascading renders)
        if (!isOpen) {
          setSearch("");
          setPatients([]);
          setLoadingPatients(false);
          if (abortRef.current) abortRef.current.abort();
        }
      }}
    >
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

          <Command label="Command Menu" shouldFilter={false}>
            <div className="flex items-center gap-3 border-b border-border-subtle px-4">
              {loadingPatients ? (
                <Loader2
                  className="h-5 w-5 shrink-0 animate-spin text-text-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <Search
                  className="h-5 w-5 shrink-0 text-text-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Busque pacientes, ações, páginas…"
                className="h-12 w-full bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="hidden h-5 items-center rounded border border-border-subtle bg-bg-muted px-1.5 font-mono text-tiny font-medium text-text-muted sm:inline-flex">
                esc
              </kbd>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-caption text-text-muted">
                {loadingPatients
                  ? "Buscando…"
                  : `Nenhum resultado para "${search}".`}
              </Command.Empty>

              {/* Pacientes (busca dinâmica — só aparece quando search >= 2 chars) */}
              {showPatients && patients.length > 0 && (
                <Command.Group heading="Pacientes">
                  <div className="px-2 pb-1 pt-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Pacientes
                  </div>
                  {patients.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`patient-${p.id}`}
                      onSelect={() => goToPatient(p.id)}
                      className={
                        "flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 " +
                        "text-body text-text-primary " +
                        "data-[selected=true]:bg-bg-subtle " +
                        "data-[selected=true]:ring-1 data-[selected=true]:ring-border-subtle"
                      }
                    >
                      <User
                        className="h-4 w-4 shrink-0 text-brand-primary"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="flex-1 truncate font-medium">
                        {p.fullName}
                      </span>
                      {p.email && (
                        <span className="text-tiny text-text-muted truncate max-w-[180px]">
                          {p.email}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Ações rápidas */}
              {quickActions.length > 0 && (
                <Command.Group heading="Ações rápidas">
                  <div className="px-2 pb-1 pt-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Ações rápidas
                  </div>
                  {quickActions.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={action.id}
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
              )}

              {/* Navegar */}
              {navActions.length > 0 && (
                <Command.Group heading="Navegar">
                  <div className="px-2 pb-1 pt-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Navegar
                  </div>
                  {navActions.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={action.id}
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
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
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
