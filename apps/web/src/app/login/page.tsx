// /login — Magic link form com novo design system

import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

function NutriCoreMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="40"
      height="40"
      fill="none"
      aria-hidden="true"
      className="text-brand-primary"
    >
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        fill="currentColor"
        fillOpacity="0.12"
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

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bg-page p-4">
      {/* Gradient blob bg — sutil verde brand */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-200px] h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-brand-primary-bg opacity-60 blur-[80px]" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo + headline */}
        <div className="mb-8 flex flex-col items-center text-center">
          <NutriCoreMark />
          <h1 className="mt-3 text-h1 font-semibold tracking-tight text-text-primary">
            NutriCore
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Plataforma para nutricionistas brasileiros
          </p>
        </div>

        {/* Card de login */}
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-md)]">
          <div className="mb-5 text-center">
            <h2 className="text-h3 font-semibold text-text-primary">
              Bem-vindo de volta
            </h2>
            <p className="mt-1 text-caption text-text-secondary">
              Entre com seu email para receber um magic link.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="py-10 text-center text-caption text-text-muted">
                Carregando...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-tiny text-text-muted">
          Sem conta? Peça convite ao administrador da sua organização.
          <br />
          <span className="opacity-70">CRN · LGPD · CFN 599/2018</span>
        </p>
      </div>
    </main>
  );
}
