"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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

  if (sent) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-4 text-center text-sm text-green-800">
        <p className="text-2xl">📬</p>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-xs font-medium">
          Email
        </label>
        <input
          id="email"
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
        className="block w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {sending ? "Enviando..." : "Enviar link mágico"}
      </button>
    </form>
  );
}
