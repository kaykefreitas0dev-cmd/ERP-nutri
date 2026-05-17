"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "magic" | "password";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
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
    } catch {
      setError("Erro ao enviar magic link. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/signin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Email ou senha incorretos");
        return;
      }
      // Sucesso → vai pro dashboard
      router.push("/app");
      router.refresh();
    } catch {
      setError("Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {errorParam && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-800"
        >
          Erro: {errorParam.replace(/_/g, " ")}
        </div>
      )}

      {/* Toggle */}
      <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setMessage(null);
            setError(null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            mode === "password"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          🔑 Email + senha
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setMessage(null);
            setError(null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            mode === "magic"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📧 Magic link
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
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
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              maxLength={72}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagic} className="space-y-4">
          <div>
            <label htmlFor="email-magic" className="block text-sm font-medium">
              Email profissional
            </label>
            <input
              id="email-magic"
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
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Enviando..." : "Enviar magic link"}
          </button>
          <p className="text-xs text-slate-500">
            ⚠️ O magic link via SMTP padrão tem rate limit baixo. Se não chegar,
            use email + senha acima.
          </p>
        </form>
      )}

      {message && (
        <div
          role="status"
          className="rounded-md bg-green-50 p-4 text-sm text-green-800"
        >
          {message}
        </div>
      )}
    </>
  );
}
