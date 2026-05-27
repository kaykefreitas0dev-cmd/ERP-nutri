"use client";

import { useState, useTransition } from "react";
import { CircleCheck, AlertCircle } from "lucide-react";

interface FormState {
  status: "idle" | "ok" | "error";
  message: string | null;
}

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({
    status: "idle",
    message: null,
  });

  async function handleSubmit(formData: FormData) {
    setState({ status: "idle", message: null });
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setState({ status: "error", message: "Senhas não conferem" });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setState({
            status: "error",
            message: data.error ?? "Erro ao trocar senha",
          });
          return;
        }
        setState({
          status: "ok",
          message: "Senha atualizada com sucesso.",
        });
        // Limpa form
        (document.getElementById("change-pw-form") as HTMLFormElement)?.reset();
      } catch {
        setState({ status: "error", message: "Erro de rede" });
      }
    });
  }

  return (
    <form id="change-pw-form" action={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-tiny font-medium text-text-secondary"
        >
          Senha atual
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="block text-tiny font-medium text-text-secondary"
        >
          Nova senha (mínimo 8 caracteres)
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-tiny font-medium text-text-secondary"
        >
          Confirme a nova senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      {state.status === "ok" && state.message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-success-border bg-success-bg px-3 py-2 text-caption text-success"
        >
          <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
          {state.message}
        </div>
      )}
      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-caption text-danger"
        >
          <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-primary px-4 py-2 text-caption font-medium text-white shadow-sm transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Atualizando..." : "Atualizar senha"}
      </button>
    </form>
  );
}
