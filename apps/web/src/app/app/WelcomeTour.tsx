"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  Utensils,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "nutricore.welcome-tour-dismissed.v1";

interface Step {
  title: string;
  description: string;
  href: string;
  cta: string;
  Icon: LucideIcon;
}

const STEPS: Step[] = [
  {
    title: "Cadastre seu primeiro paciente",
    description:
      "Comece pelo cadastro: nome, contatos, anamnese e alergias. Tudo isolado por organização (RLS).",
    href: "/app/patients/new",
    cta: "Novo paciente",
    Icon: Users,
  },
  {
    title: "Monte um plano alimentar",
    description:
      "Use a biblioteca TACO/POF com custeio FC+IC integrado. Snapshots imutáveis garantem fidelidade.",
    href: "/app/patients",
    cta: "Ver pacientes",
    Icon: Utensils,
  },
  {
    title: "Agende e conduza consultas",
    description:
      "Agenda interna com check-in. Conecte Google/Apple Calendar quando estiver pronto.",
    href: "/app/agenda",
    cta: "Abrir agenda",
    Icon: Calendar,
  },
  {
    title: "Registre pagamentos",
    description:
      "Durante o beta, anote pagamentos recebidos externamente (PIX, cartão). Recibo PDF gerado automaticamente.",
    href: "/app/financeiro",
    cta: "Financeiro",
    Icon: Wallet,
  },
  {
    title: "Personalize a sua organização",
    description:
      "Defina branding (logo, cor) e o nome que aparece nos emails enviados aos pacientes.",
    href: "/app/settings",
    cta: "Configurações",
    Icon: Settings,
  },
];

// useSyncExternalStore-friendly helpers (SSR-safe, sem setState em useEffect).
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true; // SSR/dismissed por padrão
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return true; // server-render: hidden, evita hydration mismatch
}

export function WelcomeTour() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [step, setStep] = useState(0);
  // Override local — depois de clicar "dispensar" não esperar evento storage
  const [localDismissed, setLocalDismissed] = useState(false);

  function dismiss() {
    setLocalDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      /* indisponível — banner some até refresh */
    }
  }

  if (dismissed || localDismissed) return null;

  const current = STEPS[step]!;
  const Icon = current.Icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <section
      aria-labelledby="welcome-tour-title"
      className="mb-6 overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-primary-bg to-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2 text-brand-primary">
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          <p className="text-xs font-semibold uppercase tracking-wide">
            Bem-vinda ao NutriCore
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar tour"
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 px-5 pb-5 pt-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-primary">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2
              id="welcome-tour-title"
              className="text-base font-semibold text-slate-900"
            >
              {current.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{current.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <Link
            href={current.href}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-brand-primary-hover"
          >
            {current.cta}
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-brand-100 bg-white/60 px-5 py-2.5">
        <div
          className="flex items-center gap-1.5"
          role="tablist"
          aria-label="Etapas do tour"
        >
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Etapa ${i + 1} de ${STEPS.length}`}
              onClick={() => setStep(i)}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === step
                  ? "w-6 bg-brand-primary"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400")
              }
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
            >
              Concluir
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Próximo
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
