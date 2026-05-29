import Link from "next/link";
import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata = {
  title: "Perguntas Frequentes — NutriCore",
  description:
    "Dúvidas sobre planos, segurança, LGPD, integração e como funciona a NutriCore.",
  alternates: { canonical: "/faq" },
};

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  heading: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    heading: "Planos e cobrança",
    items: [
      {
        q: "Posso cancelar a qualquer momento?",
        a: "Sim. Sem fidelidade. Você cancela direto no app e mantém acesso até o fim do ciclo já pago. Após o cancelamento, seus dados ficam disponíveis para download (LGPD Art. 18) por 90 dias.",
      },
      {
        q: "Como funciona o trial de 14 dias?",
        a: "Você usa tudo do plano escolhido sem precisar cadastrar cartão. No 15º dia, pedimos o cartão para continuar. Se não cadastrar, a conta vira somente-leitura por 7 dias até ser excluída automaticamente.",
      },
      {
        q: "Posso mudar de plano depois?",
        a: "Sim, a qualquer momento. Upgrade entra em vigor imediatamente (cobramos pro-rata da diferença). Downgrade entra em vigor no próximo ciclo de cobrança.",
      },
      {
        q: "Tem desconto no plano anual?",
        a: "Sim, 17% (equivale a 2 meses grátis). Pagamento à vista no início do ciclo.",
      },
    ],
  },
  {
    heading: "Pagamentos dos pacientes",
    items: [
      {
        q: "A NutriCore intermedia o pagamento dos meus pacientes?",
        a: "Não no MVP. Você cobra o paciente como já cobra (PIX direto na sua conta, link Asaas pessoal, cartão pela maquininha) e registra o pagamento na plataforma — a gente gera o recibo PDF e mantém o histórico. A cobrança via NutriCore (com split automático + escrow) chega em uma fase futura.",
      },
      {
        q: "A NutriCore emite nota fiscal pelos meus atendimentos?",
        a: "Não. Você emite NF-e pelo seu sistema fiscal próprio (MEI, ME, etc.). A NutriCore gera apenas o recibo simples — útil para o paciente, mas não substitui NF-e.",
      },
      {
        q: "Posso aceitar PIX direto pelo app do paciente?",
        a: "Não no MVP. O paciente paga pelo seu canal preferido (link, QR Code, transferência) e você marca como pago no app. A cobrança nativa virá com Asaas BaaS na próxima fase.",
      },
    ],
  },
  {
    heading: "Segurança e LGPD",
    items: [
      {
        q: "Onde os dados ficam?",
        a: "Banco Postgres + Supabase hospedados em São Paulo (sa-east-1, AWS). Backups diários em Cloudflare R2 (também Brasil). Toda a infra está na jurisdição brasileira.",
      },
      {
        q: "Como protegem dados sensíveis (PHI)?",
        a: "Anotações clínicas e metadados de exames são criptografados com envelope encryption (pgcrypto + Supabase Vault) usando uma chave única por organização (DEK). Sem a chave, mesmo um vazamento de DB não expõe o conteúdo.",
      },
      {
        q: "Quem pode ver os dados dos meus pacientes?",
        a: "Apenas você (e membros que você convidar para a sua organização). Multi-tenancy é enforçado em duas camadas: aplicação (withTenant wrapper) + banco (Row-Level Security policies). Auditoria registra toda leitura de PHI.",
      },
      {
        q: "E se o paciente pedir para apagar os dados (LGPD Art. 18)?",
        a: "Você anonimiza pela tela do paciente em 2 cliques. Dados pessoais (nome, CPF, contatos) são substituídos por placeholders permanentemente. Notas clínicas têm o conteúdo apagado. Documentos emitidos (recibos, atestados) são preservados — são prova de emissão para fins fiscais e regulatórios.",
      },
      {
        q: "Vocês compartilham meus dados com terceiros?",
        a: "Não. Não há venda nem compartilhamento de PII. Sub-processadores estão listados no nosso termo de DPA (Data Processing Agreement): Supabase (DB + auth + storage), Vercel (hospedagem), Cloudflare (CDN + R2 backup), AWS SES + Resend (email transacional), Upstash (rate limit + cache).",
      },
    ],
  },
  {
    heading: "Funcionalidades",
    items: [
      {
        q: "Quais bases nutricionais estão incluídas?",
        a: "TACO 4ª edição + POF 2017-2018 (~2.500 alimentos brasileiros). Você também pode cadastrar alimentos custom com seus preços regionais.",
      },
      {
        q: "Posso importar pacientes de outras plataformas?",
        a: "Sim. Importação via CSV (até 5.000 linhas por arquivo). Templates prontos para Dietbox e Webdiet. Para outras plataformas, basta mapear as colunas no wizard.",
      },
      {
        q: "O paciente precisa baixar um app?",
        a: "Não — é PWA (Progressive Web App). Funciona pelo navegador em qualquer celular. Quem quiser pode adicionar à tela inicial (vira igual a um app nativo).",
      },
      {
        q: "Posso atender por vídeo chamada?",
        a: "Sim. Quando você cria uma consulta com modalidade 'vídeo', geramos automaticamente um link do Google Meet (precisa conectar sua conta Google uma única vez).",
      },
      {
        q: "Funciona offline?",
        a: "Parcialmente. O PWA do paciente cacheia o plano alimentar e check-ins offline; sincroniza quando voltar a internet. O app do nutricionista requer conexão (operações críticas como prescrição).",
      },
    ],
  },
  {
    heading: "Integrações",
    items: [
      {
        q: "Tem integração com Google Calendar?",
        a: "Sim. Após conectar (OAuth uma vez), suas consultas NutriCore aparecem no Calendar, e bloqueios manuais do Calendar viram indisponibilidade na agenda da plataforma. Sync bidirecional a cada 15 minutos.",
      },
      {
        q: "Tem API pública para integração?",
        a: "Sim no plano Clínica. Documentação OpenAPI 3.1. Webhooks para eventos de consulta, pagamento e check-in.",
      },
      {
        q: "Funciona com sistema de bioimpedância?",
        a: "Você cadastra manualmente os resultados (% gordura, massa magra, etc.) na ficha antropométrica. Integração direta com aparelhos InBody/Tanita virá no roadmap futuro.",
      },
    ],
  },
  {
    heading: "Suporte",
    items: [
      {
        q: "Como funciona o suporte?",
        a: "Solo: email (resposta em 48h). Pro: email prioritário (24h). Clínica: suporte dedicado + onboarding 1:1 + WhatsApp Business.",
      },
      {
        q: "Tem treinamento ou tutorial?",
        a: "Sim. Tour interativo no primeiro login + base de conhecimento + vídeos curtos para cada feature. Para o plano Clínica, oferecemos call de onboarding 1:1 (60 min).",
      },
      {
        q: "E se eu encontrar um bug?",
        a: "Reporta pelo email (suporte@nutricore.app) ou pelo formulário em /contato. Bugs críticos (P1) corrigidos em até 4 horas; P2 em 24h; P3 em 7 dias.",
      },
    ],
  },
];

export default function FAQPage() {
  // JSON-LD structured data para Google rich snippets
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-bg-page py-12">
        <Container size="md">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <header>
            <h1 className="text-h1 font-bold tracking-tight text-text-primary sm:text-4xl">
              Perguntas frequentes
            </h1>
            <p className="mt-3 text-body text-text-secondary">
              Não achou sua dúvida?{" "}
              <Link
                href="/contato"
                className="font-medium text-brand-primary hover:underline"
              >
                Fale com a gente
              </Link>
              .
            </p>
          </header>

          <div className="mt-10 space-y-10">
            {FAQ_SECTIONS.map((section) => (
              <section key={section.heading}>
                <h2 className="text-h2 font-semibold text-text-primary">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <Card key={item.q}>
                      <CardContent className="p-4">
                        <h3 className="text-body font-semibold text-text-primary">
                          {item.q}
                        </h3>
                        <p className="mt-1.5 text-caption text-text-secondary">
                          {item.a}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-12 rounded-xl border border-border-subtle bg-bg-surface p-6 text-center">
            <p className="text-body text-text-secondary">
              Ainda com dúvidas? Estamos no email{" "}
              <a
                href="mailto:suporte@nutricore.app"
                className="font-medium text-brand-primary hover:underline"
              >
                suporte@nutricore.app
              </a>
              .
            </p>
          </footer>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
