"use client";

import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { submitContactAction } from "./actions";

interface FormState {
  status: "idle" | "submitting" | "success" | "error";
  message: string | null;
}

export function ContactForm() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({
    status: "idle",
    message: null,
  });

  async function handleSubmit(formData: FormData) {
    setState({ status: "submitting", message: null });
    startTransition(async () => {
      const result = await submitContactAction(formData);
      setState({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
    });
  }

  if (state.status === "success") {
    return (
      <div className="rounded-md bg-success-bg p-6 text-center text-sm text-success">
        <p className="flex items-center justify-center gap-2 font-medium">
          <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
          Mensagem recebida!
        </p>
        <p className="mt-2">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-800"
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-text-primary"
          >
            Nome completo *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="mt-1 block w-full rounded-md border border-border-default bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-text-primary"
          >
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-md border border-border-default bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-text-primary"
        >
          WhatsApp (opcional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(11) 99999-9999"
          className="mt-1 block w-full rounded-md border border-border-default bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-text-primary"
        >
          Assunto *
        </label>
        <select
          id="subject"
          name="subject"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-border-default bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        >
          <option value="" disabled>
            Selecione…
          </option>
          <option value="commercial">Comercial (planos, preços)</option>
          <option value="support">Suporte técnico</option>
          <option value="partnership">Parceria</option>
          <option value="press">Imprensa</option>
          <option value="other">Outro</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-text-primary"
        >
          Mensagem *
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="mt-1 block w-full rounded-md border border-border-default bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      <p className="text-xs text-text-muted">
        Ao enviar, você concorda com nossa{" "}
        <a href="/privacidade" className="text-brand-primary underline">
          política de privacidade
        </a>
        .
      </p>

      <button
        type="submit"
        disabled={pending || state.status === "submitting"}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending || state.status === "submitting"
          ? "Enviando…"
          : "Enviar mensagem"}
      </button>
    </form>
  );
}
