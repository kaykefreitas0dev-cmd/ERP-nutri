"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, MailCheck, TriangleAlert } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "magic" | "password";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Digite um email válido");
      return;
    }
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setSending(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@") || password.length < 6) {
      setError("Email ou senha inválidos");
      return;
    }
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Email ou senha incorretos",
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-4 text-center text-sm text-green-800">
        <MailCheck
          className="mx-auto h-8 w-8 text-green-600"
          strokeWidth={1.5}
        />
        <p className="mt-2 font-medium">Email enviado!</p>
        <p className="mt-1 text-xs">
          Verifique sua caixa de entrada (e spam) em <strong>{email}</strong> e
          clique no link para entrar.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="mt-3 text-xs text-green-700 underline"
        >
          Usar outro email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === "password"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600"
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
          Email + senha
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === "magic"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600"
          }`}
        >
          <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
          Magic link
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePassword} className="space-y-3">
          <div>
            <label htmlFor="email-pwd" className="block text-xs font-medium">
              Email
            </label>
            <input
              id="email-pwd"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium">
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
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="block w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {sending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagic} className="space-y-3">
          <div>
            <label htmlFor="email-magic" className="block text-xs font-medium">
              Email
            </label>
            <input
              id="email-magic"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="block w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar link mágico"}
          </button>
          <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <TriangleAlert className="h-3 w-3" strokeWidth={2} />
            Se não chegar email, use senha acima.
          </p>
        </form>
      )}
    </div>
  );
}
