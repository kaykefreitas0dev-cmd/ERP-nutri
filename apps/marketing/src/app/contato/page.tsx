import { Suspense } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { Container } from "@repo/ui/container";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contato",
  description: "Fale com o time NutriCore. Suporte técnico ou comercial.",
};

export default function ContatoPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-bg-subtle py-16">
        <Container size="md">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Fale com a gente
            </h1>
            <p className="mt-3 text-lg text-text-secondary">
              Suporte técnico, dúvidas comerciais ou parcerias. Respondemos em
              até 1 dia útil.
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Email direto:{" "}
              <a
                href="mailto:suporte@nutricore.app"
                className="text-brand-primary underline"
              >
                suporte@nutricore.app
              </a>
            </p>
          </div>

          <div className="mt-10 rounded-lg border border-border-subtle bg-white p-6 shadow-sm sm:p-8">
            <Suspense
              fallback={
                <p className="text-sm text-text-muted">
                  Carregando formulário…
                </p>
              }
            >
              <ContactForm />
            </Suspense>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
