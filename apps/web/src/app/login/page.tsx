// /login — Editorial "Verde Clínico" split layout: painel floresta + formulário.

import { Suspense } from "react";
import { CalendarCheck, ClipboardList, ShieldCheck } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

function NutriCoreMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 21V11l8 8V8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const VALUE_PROPS = [
  {
    Icon: ClipboardList,
    title: "Planos e prontuário num lugar só",
    body: "Anamnese, antropometria, planos alimentares e documentos do paciente.",
  },
  {
    Icon: CalendarCheck,
    title: "Agenda, lembretes e recibos",
    body: "Consultas presenciais ou por vídeo, com confirmação automática.",
  },
  {
    Icon: ShieldCheck,
    title: "Conforme LGPD e CFN",
    body: "Dados clínicos criptografados, trilha de auditoria e portabilidade.",
  },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ── Painel editorial floresta (desktop) ───────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-primary px-12 py-10 text-white lg:flex">
        {/* textura sutil — folha grande translúcida */}
        <NutriCoreMark className="pointer-events-none absolute -right-16 -top-10 h-[420px] w-[420px] text-white/5" />

        <div className="relative flex items-center gap-2.5">
          <NutriCoreMark className="h-7 w-7 text-white" />
          <span className="font-display text-h2 font-semibold tracking-tight">
            NutriCore
          </span>
        </div>

        <div className="relative max-w-md">
          <p className="text-tiny font-semibold uppercase tracking-[0.18em] text-white/60">
            Plataforma clínica de nutrição
          </p>
          <h1 className="mt-3 font-display text-[2.5rem] font-semibold leading-[1.1] tracking-tight">
            Cuidado nutricional, com clareza clínica.
          </h1>
          <p className="mt-4 text-body leading-relaxed text-white/75">
            Tudo que o consultório precisa para acompanhar pacientes do primeiro
            atendimento ao resultado — sem planilhas soltas.
          </p>
        </div>

        <ul className="relative space-y-px">
          {VALUE_PROPS.map(({ Icon, title, body }, i) => (
            <li
              key={title}
              className={
                "flex items-start gap-3 py-3.5 " +
                (i > 0 ? "border-t border-white/10" : "")
              }
            >
              <Icon
                className="mt-0.5 h-[18px] w-[18px] shrink-0 text-white/80"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-caption font-medium text-white">{title}</p>
                <p className="mt-0.5 text-tiny leading-relaxed text-white/65">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Coluna do formulário ──────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center bg-bg-page px-5 py-12">
        <div className="w-full max-w-sm">
          {/* Marca (visível sobretudo no mobile, sem o painel) */}
          <div className="mb-9 flex items-center gap-2.5 lg:hidden">
            <NutriCoreMark className="h-7 w-7 text-brand-primary" />
            <span className="font-display text-h2 font-semibold tracking-tight text-text-primary">
              NutriCore
            </span>
          </div>

          <p className="section-label">Entrar</p>
          <h2 className="mt-1.5 font-display text-h1 font-semibold tracking-tight text-text-primary">
            Bem-vindo de volta
          </h2>
          <p className="mt-2 text-caption text-text-secondary">
            Informe seu email para receber um magic link de acesso.
          </p>

          <div className="mt-7">
            <Suspense
              fallback={
                <div className="py-10 text-center text-caption text-text-muted">
                  Carregando…
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          <hr className="editorial-rule my-7" />

          <p className="text-tiny leading-relaxed text-text-muted">
            Sem conta? Peça um convite ao administrador da sua organização.
            <br />
            <span className="text-text-subtle">CRN · LGPD · CFN 599/2018</span>
          </p>
        </div>
      </section>
    </main>
  );
}
