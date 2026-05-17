import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";

const FEATURES = [
  {
    icon: "📅",
    title: "Agenda integrada",
    description:
      "Agendamento online + lembretes automáticos por WhatsApp e e-mail. Sincronização com Google Calendar.",
  },
  {
    icon: "📋",
    title: "Prontuário eletrônico",
    description:
      "Anamnese, antropometria, exames e evolução. Conforme CFN 599/2018 — anotações criptografadas e imutáveis.",
  },
  {
    icon: "🍽️",
    title: "Planos alimentares com custeio",
    description:
      "Drag-and-drop com cálculo automático de macros + estimativa de custo em R$ por refeição (TACO + POF).",
  },
  {
    icon: "📱",
    title: "App do paciente (PWA)",
    description:
      "Paciente registra refeições, água e peso. Funciona offline, instalável como app no celular. Sem app store.",
  },
  {
    icon: "💸",
    title: "Pagamentos com split",
    description:
      "Cobra paciente via Pix/cartão. Plataforma retém apenas a fee acordada — você recebe automaticamente.",
  },
  {
    icon: "🎮",
    title: "Gamificação real",
    description:
      "Streaks de aderência, achievements e vouchers de desconto. Engajamento ligado ao seu faturamento.",
  },
  {
    icon: "📊",
    title: "Antropometria com gráficos",
    description:
      "Protocolos Pollock 7/3, Jackson-Pollock, OMS pediátrico. Evolução visual de peso, IMC, dobras.",
  },
  {
    icon: "📦",
    title: "Migração assistida",
    description:
      "Importe pacientes do Dietbox/Webdiet com wizard de mapeamento. Não comece do zero.",
  },
];

export function Features() {
  return (
    <section
      id="funcionalidades"
      className="border-b border-slate-100 bg-white py-20"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tudo que você precisa para atender bem
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Substitui agenda, prontuário, dieta e app paciente — em uma única conta.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="text-3xl" aria-hidden>
                  {f.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
