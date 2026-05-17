import Link from "next/link";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";

export const metadata = {
  title: "NutriCore para Clínicas",
  description:
    "Para clínicas com 3+ nutricionistas: gestão de equipe, dashboard financeiro consolidado, multi-tenant LGPD-ready.",
};

const FEATURES = [
  {
    title: "Equipe multi-profissional",
    body: "Cada nutri tem sua agenda, seus pacientes, seus documentos. Admin da clínica vê tudo consolidado.",
  },
  {
    title: "Dashboard financeiro consolidado",
    body: "GMV mensal da clínica, ticket médio por profissional, breakdown por método de pagamento — tudo em /app/financeiro.",
  },
  {
    title: "Branding por clínica",
    body: "Logo da clínica nos PDFs (atestados, receitas, recibos). Email de convite com nome da clínica.",
  },
  {
    title: "RBAC: owner / admin / nutri / suporte",
    body: "Org owner controla quem vê o quê. Suporte só vê pacientes atribuídos. Admin pode suspender nutri sem perder histórico.",
  },
  {
    title: "Multi-tenant by design",
    body: "Cada clínica em isolamento total (Postgres RLS + FORCE + audit log). Zero risco de leak entre clínicas mesmo no mesmo DB.",
  },
  {
    title: "Audit log imutável (LGPD Art. 41)",
    body: "Toda leitura/escrita de PHI gravada com hash chain. DPO da clínica pode exportar pra qualquer momento.",
  },
];

export default function ClinicaPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen">
        <section className="bg-gradient-to-b from-bg-subtle to-white px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 inline-block rounded-full bg-bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wider text-text-primary">
              Para clínicas (3-30 nutris)
            </p>
            <h1 className="text-4xl font-bold text-text-primary sm:text-5xl">
              Operação clínica{" "}
              <span className="text-brand-primary">profissional</span>, não
              improvisada
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
              Sua clínica cresceu. Agora cada nutri usa um sistema diferente,
              ninguém tem visão consolidada, e LGPD virou pesadelo. NutriCore
              centraliza sem perder a autonomia de cada profissional.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/contato"
                className="rounded-md bg-brand-primary px-6 py-3 text-base font-medium text-white hover:bg-brand-primary-hover"
              >
                Falar com vendas
              </Link>
              <Link
                href="/#pricing"
                className="rounded-md border border-border-default bg-white px-6 py-3 text-base font-medium hover:bg-bg-subtle"
              >
                Ver planos Clínica
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-text-primary">
              Por que clínicas escolhem NutriCore
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-lg border border-border-subtle bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-text-primary">{f.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-bg-subtle px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-text-primary">
              Onboarding assistido
            </h2>
            <p className="mt-3 text-text-secondary">
              Migração de até 500 pacientes feita pela nossa equipe sem custo
              adicional. Setup do branding + treinamento de 1h com cada
              nutricionista da equipe. Você está rodando em ≤ 7 dias.
            </p>
            <Link
              href="/contato"
              className="mt-6 inline-block text-brand-primary hover:underline"
            >
              Agendar demo →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
