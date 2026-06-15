import type { Metadata } from "next";
import { SectionHeader } from "@repo/ui/section-header";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "Segurança",
};

export const dynamic = "force-dynamic";

export default function SegurancaPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <SectionHeader
        as="h1"
        label="Configurações"
        title="Segurança"
        description="Gerencie a senha e o acesso da sua conta."
        className="mb-6"
      />

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
