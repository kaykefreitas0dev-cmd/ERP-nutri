import Link from "next/link";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";

export const metadata = {
  title: "NutriCore para Nutricionistas Autônomos",
  description:
    "Plataforma completa para nutricionistas autônomos: planos alimentares, agenda, prontuário criptografado, recibos digitais e LGPD.",
};

const FEATURES = [
  {
    title: "Planos alimentares com cálculo automático",
    body: "Use TACO + POF (~2.500 alimentos brasileiros). Macros, custo e adesão calculados em tempo real.",
  },
  {
    title: "Agenda integrada com Google Calendar",
    body: "Pacientes agendam online via /c/seu-nome. Bloqueio anti-double-booking + lembretes automáticos.",
  },
  {
    title: "Prontuário criptografado (LGPD compliant)",
    body: "Anotações clínicas com encryption at rest. CFN audit trail imutável.",
  },
  {
    title: "Recibos PDF assinados",
    body: "Marca consulta como concluída, recibo PDF gera automático com seu CRN e numeração sequencial.",
  },
  {
    title: "App do paciente incluso",
    body: "Seu paciente acessa plano + check-ins + documentos pelo celular sem instalar nada.",
  },
  {
    title: "Você cobra; nós só registramos",
    body: "Sem intermediação: você usa seu PIX/cartão pessoal, plataforma registra pra controle e gera o recibo. Sem taxas extras.",
  },
];

export default function NutriSoloPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-b from-brand-primary-bg to-white px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand-primary-hover">
              Para nutricionistas autônomos
            </p>
            <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
              Toda a operação da sua consultoria em{" "}
              <span className="text-brand-primary">um lugar</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              Pare de juntar Dietbox + WhatsApp + Google Agenda + boleto na mão.
              NutriCore tem prontuário, agenda, plano alimentar, recibo e app do
              paciente — tudo integrado.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/contato"
                className="rounded-md bg-brand-primary px-6 py-3 text-base font-medium text-white hover:bg-brand-primary-hover"
              >
                Quero começar
              </Link>
              <Link
                href="/"
                className="rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-medium hover:bg-slate-50"
              >
                Ver planos
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              O que você ganha
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="bg-slate-50 px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              Investimento honesto
            </h2>
            <p className="mt-3 text-slate-600">
              Plano Starter pra quem está começando. Sem fidelidade. Sem taxa
              por paciente. Cobramos uma mensalidade fixa que cabe no orçamento
              de um autônomo.
            </p>
            <Link
              href="/#pricing"
              className="mt-6 inline-block text-brand-primary hover:underline"
            >
              Ver tabela de preços →
            </Link>
          </div>
        </section>

        {/* FAQ específico */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Perguntas comuns
            </h2>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="font-semibold text-slate-900">
                  Posso migrar do Dietbox?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Sim. Use nosso importador CSV (Configurações → Importar
                  pacientes) com mapping automático pros formatos Dietbox e
                  Webdiet.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">
                  E a NF-e dos recibos?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Hoje geramos recibo simples (vale pra controle interno + IRPF
                  do paciente). NF-e completa via Focus NFe chega na Fase 7, por
                  enquanto você emite no seu sistema fiscal próprio.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">
                  Como funciona o pagamento dos pacientes?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Você cobra como sempre faz (PIX próprio, cartão, dinheiro). Na
                  hora de marcar a consulta como concluída, registra o valor +
                  método → plataforma gera o recibo assinado. Sem intermediação
                  financeira (= sem taxas extras pra você).
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">
                  É LGPD compliant?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Sim. Dados em isolamento por organização (RLS), prontuário
                  criptografado, audit log imutável com hash chain, export ZIP +
                  anonimização disponíveis pra atender Art. 18.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
