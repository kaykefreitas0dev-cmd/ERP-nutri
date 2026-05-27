import type { Metadata } from "next";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "Segurança",
};

export const dynamic = "force-dynamic";

export default function SegurancaPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
          Conta
        </p>
        <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
          Segurança
        </h1>
        <p className="mt-1 text-caption text-text-secondary">
          Gerencie a senha e o acesso da sua conta.
        </p>
      </header>

      <section className="rounded-xl border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)]">
        <h2 className="text-h3 font-semibold text-text-primary">
          Trocar senha
        </h2>
        <p className="mt-1 text-caption text-text-secondary">
          A nova senha precisa ter pelo menos 8 caracteres.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
