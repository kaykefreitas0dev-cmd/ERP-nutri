"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  token: string;
  defaultEmail: string;
}

export function AcceptInviteForm({ token, defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Email inválido");
      return;
    }
    if (email.trim().toLowerCase() !== defaultEmail.trim().toLowerCase()) {
      setError(
        "Use o mesmo email para o qual o convite foi enviado (" +
          defaultEmail +
          ").",
      );
      return;
    }

    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Magic link com next=/auth/accept-invite?token=...
      const next = `/auth/accept-invite?token=${encodeURIComponent(token)}`;
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
        <p className="text-3xl">📬</p>
        <p className="mt-2 font-medium">Email enviado!</p>
        <p className="mt-1 text-xs">
          Verifique sua caixa de entrada em <strong>{email}</strong>. Clique no
          link mágico para finalizar e entrar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="invite-email" className="block text-xs font-medium">
          Confirme seu email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {sending ? "Enviando..." : "📧 Aceitar convite e receber link"}
      </button>
    </form>
  );
}
