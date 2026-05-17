// /login — Magic link form (S2a básico; UX polida em S2b com Design System)

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setMessage(
        data.message ??
          "Se você tem acesso a uma organização NutriCore, verifique seu email em até 5 minutos.",
      );
    } catch (err) {
      console.error(err);
      setMessage("Erro ao enviar magic link. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-teal-700">NutriCore</h1>
          <p className="mt-2 text-sm text-gray-600">
            Entre com seu email para receber o magic link
          </p>
        </div>

        {errorParam && (
          <div
            role="alert"
            className="rounded-md bg-red-50 p-4 text-sm text-red-800"
          >
            Erro: {errorParam.replace(/_/g, " ")}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email profissional
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="voce@clinica.com.br"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Enviando..." : "Enviar magic link"}
          </button>
        </form>

        {message && (
          <div
            role="status"
            className="rounded-md bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        <p className="text-center text-xs text-gray-500">
          Sem conta? Peça convite ao administrador da sua organização.
          <br />
          <span className="text-gray-400">(Lock 7 — Invite-Only)</span>
        </p>
      </div>
    </main>
  );
}
