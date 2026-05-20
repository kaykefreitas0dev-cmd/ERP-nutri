"use client";

import {
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, CircleCheck, Loader2 } from "lucide-react";
import { submitNpsAction } from "./actions";

const DISMISS_KEY = "nutricore.nps.dismissed-until.v1";
const SUBMITTED_KEY = "nutricore.nps.submitted-at.v1";
const SNOOZE_DAYS = 30;

function snoozedNow(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const submitted = window.localStorage.getItem(SUBMITTED_KEY);
    if (submitted) {
      const t = Number(submitted);
      if (Number.isFinite(t) && Date.now() - t < SNOOZE_DAYS * 86_400_000) {
        return true;
      }
    }
    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const t = Number(dismissed);
      if (Number.isFinite(t) && Date.now() < t) return true;
    }
  } catch {
    /* localStorage indisponível */
  }
  return false;
}

function getServerSnapshot(): boolean {
  return true; // SSR: hidden
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function setSnooze(days: number) {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + days * 86_400_000),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: DISMISS_KEY }));
  } catch {
    /* ignora */
  }
}

function setSubmitted() {
  try {
    window.localStorage.setItem(SUBMITTED_KEY, String(Date.now()));
    window.dispatchEvent(new StorageEvent("storage", { key: SUBMITTED_KEY }));
  } catch {
    /* ignora */
  }
}

export function NpsWidget() {
  const pathname = usePathname();
  const snoozed = useSyncExternalStore(
    subscribe,
    snoozedNow,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (snoozed) return null;

  function close() {
    setOpen(false);
    setScore(null);
    setComment("");
    setError(null);
    setDone(false);
  }

  function dismissForever() {
    setSnooze(SNOOZE_DAYS);
    close();
  }

  function snoozeShort() {
    setSnooze(3); // 3 dias
    close();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (score == null) return;
    setError(null);

    startTransition(async () => {
      const res = await submitNpsAction({
        score,
        comment: comment.trim() || undefined,
        context: pathname ?? undefined,
      });
      if (!res.ok) {
        setError(res.message ?? "Erro inesperado");
        return;
      }
      setDone(true);
      setSubmitted();
      setTimeout(() => close(), 1800);
    });
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-4 text-body font-medium text-text-secondary shadow-lg transition hover:border-brand-400 hover:text-brand-primary"
          aria-label="Enviar feedback"
        >
          <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
          Feedback
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="nps-title"
          className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xl)]"
        >
          <div className="flex items-start justify-between px-4 pt-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
                Beta — sua opinião conta
              </p>
              <h3
                id="nps-title"
                className="mt-1 text-body font-semibold text-text-primary"
              >
                {done
                  ? "Obrigado!"
                  : "De 0 a 10, o quanto você recomendaria o NutriCore?"}
              </h3>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="rounded-md p-1 text-text-subtle transition hover:bg-bg-subtle hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {done ? (
            <div className="flex items-center gap-2 px-4 py-4 text-body text-success">
              <CircleCheck className="h-5 w-5" strokeWidth={1.75} />
              Feedback registrado. Vamos usar isso pra melhorar.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="px-4 pb-4 pt-3">
              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                  const selected = score === n;
                  const tone =
                    n <= 6
                      ? "border-danger-border hover:border-danger hover:text-danger"
                      : n <= 8
                        ? "border-warning-border hover:border-warning hover:text-warning"
                        : "border-success-border hover:border-success hover:text-success";
                  const selectedTone =
                    n <= 6
                      ? "border-danger bg-danger text-white"
                      : n <= 8
                        ? "border-warning bg-warning text-white"
                        : "border-success bg-success text-white";
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(n)}
                      className={
                        "flex h-9 items-center justify-center rounded-md border text-tiny font-semibold transition " +
                        (selected
                          ? selectedTone
                          : "bg-bg-surface text-text-secondary " + tone)
                      }
                      aria-pressed={selected}
                      aria-label={`Nota ${n}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>Nem um pouco</span>
                <span>Com certeza</span>
              </div>

              {score != null && (
                <label className="mt-3 block text-tiny font-medium text-text-secondary">
                  {score <= 6
                    ? "O que mais incomoda hoje?"
                    : score <= 8
                      ? "O que faria virar 9 ou 10?"
                      : "O que está funcionando bem?"}
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={800}
                    rows={3}
                    placeholder="Opcional"
                    className="mt-1 block w-full resize-none rounded-md border border-border-default bg-bg-surface px-2.5 py-2 text-tiny text-text-primary outline-none transition focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                  />
                </label>
              )}

              {error && (
                <p className="mt-2 rounded-md bg-danger-bg px-2 py-1 text-tiny text-danger">
                  {error}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2 text-[11px] text-text-muted">
                  <button
                    type="button"
                    onClick={snoozeShort}
                    className="underline-offset-2 hover:text-text-secondary hover:underline"
                  >
                    Depois
                  </button>
                  <button
                    type="button"
                    onClick={dismissForever}
                    className="underline-offset-2 hover:text-text-secondary hover:underline"
                  >
                    Não mostrar mais
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={score == null || pending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-primary px-3 text-tiny font-medium text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:bg-bg-muted"
                >
                  {pending && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={2}
                    />
                  )}
                  Enviar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
