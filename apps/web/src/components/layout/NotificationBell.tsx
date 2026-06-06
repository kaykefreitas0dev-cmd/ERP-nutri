"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, Inbox } from "lucide-react";
import {
  listNotificationsAction,
  getUnreadCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationItem,
} from "@/app/app/notifications/actions";

const POLL_MS = 60_000;

function relativeTime(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * NotificationBell — sino do topbar com contagem de não-lidas + dropdown.
 *
 * - Conta não-lidas no mount e via polling leve (60s).
 * - Ao abrir, carrega a lista recente.
 * - Clicar numa notificação: marca como lida + navega (se houver link).
 * - "Marcar todas como lidas".
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Polling leve da contagem de não-lidas.
  useEffect(() => {
    let active = true;
    async function refresh() {
      const count = await getUnreadCountAction();
      if (active) setUnread(count);
    }
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Fechar ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listNotificationsAction(20);
      setItems(result.items);
      setUnread(result.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadList();
  }

  function handleItemClick(n: NotificationItem) {
    if (!n.read) {
      // Otimista: marca local + decrementa.
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
      );
      setUnread((c) => Math.max(0, c - 1));
      startTransition(async () => {
        await markNotificationReadAction(n.id);
      });
    }
    if (n.linkPath) {
      setOpen(false);
      router.push(n.linkPath);
    }
  }

  function handleMarkAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold leading-none text-white tabular-nums ring-2 ring-bg-surface">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[90] mt-2 w-80 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-lg)]">
          <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
            <h2 className="text-body font-semibold text-text-primary">
              Notificações
            </h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-tiny text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary"
              >
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Marcar todas
              </button>
            )}
          </header>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-tiny text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Carregando…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Inbox className="h-6 w-6 text-text-muted" strokeWidth={1.5} />
                <p className="text-tiny text-text-muted">
                  Nenhuma notificação por enquanto.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={
                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-bg-subtle " +
                        (n.read ? "" : "bg-brand-primary-bg/40")
                      }
                    >
                      <span
                        className={
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " +
                          (n.read ? "bg-transparent" : "bg-brand-primary")
                        }
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={
                              "truncate text-body " +
                              (n.read
                                ? "text-text-secondary"
                                : "font-semibold text-text-primary")
                            }
                          >
                            {n.title}
                          </span>
                          <span className="shrink-0 text-tiny text-text-muted tabular-nums">
                            {relativeTime(n.createdAt)}
                          </span>
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block line-clamp-2 text-tiny text-text-muted">
                            {n.body}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
