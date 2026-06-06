import { Container } from "@repo/ui/container";
import { Sparkles, ShieldCheck, CreditCard, Clock } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Começar grátis — NutriCore",
  description:
    "Solicite seu acesso ao NutriCore. 14 dias grátis, sem cartão. Plataforma de gestão para nutricionistas brasileiros.",
  alternates: { canonical: "/signup" },
  robots: { index: false, follow: true },
};

interface Props {
  searchParams: Promise<{ plan?: string }>;
}

export default async function SignupPage({ searchParams }: Props) {
  const { plan } = await searchParams;
  const safePlan = (plan ?? "").toString().slice(0, 40);

  return (
    <>
      <SiteHeader />
      <main className="bg-bg-page py-12">
        <Container size="md">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            {/* Coluna esquerda — proposta de valor */}
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary-bg px-3 py-1 text-tiny font-medium text-brand-primary">
                <Sparkles className="h-3 w-3" strokeWidth={2} /> 14 dias grátis
              </span>
              <h1 className="mt-4 text-h1 font-bold tracking-tight text-text-primary sm:text-4xl">
                Comece a usar o NutriCore
              </h1>
              <p className="mt-3 text-body text-text-secondary">
                Durante o beta, o acesso é liberado manualmente para garantir
                qualidade no atendimento. Deixe seus dados e liberamos sua conta
                rapidinho — você cobra o paciente como já cobra hoje (PIX,
                cartão), a gente cuida do plano alimentar e do acompanhamento.
              </p>

              <ul className="mt-6 space-y-3 text-caption text-text-secondary">
                <li className="flex items-start gap-2">
                  <Clock
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                    strokeWidth={1.75}
                  />
                  14 dias grátis para testar tudo.
                </li>
                <li className="flex items-start gap-2">
                  <CreditCard
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                    strokeWidth={1.75}
                  />
                  Sem cartão de crédito para começar.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                    strokeWidth={1.75}
                  />
                  Dados no Brasil (sa-east-1) · LGPD · CFN 599/2018.
                </li>
              </ul>
            </div>

            {/* Coluna direita — formulário */}
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-md)]">
              <h2 className="text-h3 font-semibold text-text-primary">
                Solicitar acesso
              </h2>
              <p className="mt-1 text-caption text-text-secondary">
                Preencha e entraremos em contato para liberar sua conta.
              </p>
              <div className="mt-5">
                <SignupForm plan={safePlan} />
              </div>
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
