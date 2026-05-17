// /login — Magic link form (S2a básico; UX polida em S2b com Design System)

import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-teal-700">NutriCore</h1>
          <p className="mt-2 text-sm text-gray-600">
            Entre com seu email para receber o magic link
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-gray-500">Carregando...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-gray-500">
          Sem conta? Peça convite ao administrador da sua organização.
          <br />
          <span className="text-gray-400">(Lock 7 — Invite-Only)</span>
        </p>
      </div>
    </main>
  );
}
