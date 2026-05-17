import { Container } from "@repo/ui/container";

const FAQ_ITEMS = [
  {
    q: "Preciso instalar algo?",
    a: "Não. NutriCore roda no navegador — acessa de qualquer dispositivo. O app do paciente é um PWA (Progressive Web App): basta abrir o link e o paciente instala como app, sem app store.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Tudo armazenado em servidores brasileiros (São Paulo), criptografado em repouso e trânsito. Anotações clínicas usam criptografia adicional por organização (envelope encryption). Atendemos LGPD, CFN 599/2018 e Lei 13.787/2018 (prontuário eletrônico).",
  },
  {
    q: "Vou perder meus dados se cancelar?",
    a: "Não. A qualquer momento você pode solicitar o export completo (todos pacientes, planos, agendamentos, financeiro) em formato aberto JSON + PDFs. Levamos no máximo 6 horas. Sem vendor lock-in.",
  },
  {
    q: "Funciona para clínica com múltiplos profissionais?",
    a: "Sim, plano Clínica suporta até 10 profissionais com controle de permissões (owner, nutricionista sênior, nutricionista, assistente, recepcionista, financeiro). Cada um vê apenas o que precisa.",
  },
  {
    q: "Posso migrar meus pacientes do Dietbox ou Webdiet?",
    a: "Sim. Temos wizard de migração com mapeamento de colunas — você sobe seu CSV (até 5 mil pacientes), conecta as colunas com nosso schema, e o sistema importa em background. Você pode reverter em até 24h.",
  },
  {
    q: "Como funciona a cobrança do paciente?",
    a: "Você emite cobrança via Pix, boleto ou cartão. A plataforma usa subcontas Asaas — a fee acordada (5,99% + R$1) sai automaticamente, o restante vai pra sua conta em D+1. KYC simplificado (CPF + selfie).",
  },
  {
    q: "Tenho responsabilidade pela emissão de NF-e?",
    a: "Sim. NutriCore emite NF-e apenas sobre a fee retida pela plataforma. Você é responsável por emitir NF-e da consulta no seu sistema fiscal (MEI ou contador). Estamos preparando integração com Focus NFe e eNotas para automação (Fase 7).",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-white py-20">
      <Container size="md">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Tirando dúvidas mais comuns. Ainda restou alguma?{" "}
            <a href="/contato" className="text-brand-primary underline">
              Fale com a gente
            </a>
            .
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {FAQ_ITEMS.map((item, idx) => (
            <details
              key={item.q}
              className="group rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:bg-slate-50"
              open={idx === 0}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {item.q}
                </h3>
                <svg
                  aria-hidden
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
