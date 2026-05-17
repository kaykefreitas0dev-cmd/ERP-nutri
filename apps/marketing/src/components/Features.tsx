import {
  Calendar,
  FileText,
  UtensilsCrossed,
  Smartphone,
  CreditCard,
  Trophy,
  LineChart,
  PackageOpen,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";

interface Feature {
  Icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    Icon: Calendar,
    title: "Agenda integrada",
    description:
      "Agendamento online + lembretes automáticos por WhatsApp e e-mail. Sincronização com Google Calendar.",
  },
  {
    Icon: FileText,
    title: "Prontuário eletrônico",
    description:
      "Anamnese, antropometria, exames e evolução. Conforme CFN 599/2018 — anotações criptografadas e imutáveis.",
  },
  {
    Icon: UtensilsCrossed,
    title: "Planos alimentares com custeio",
    description:
      "Drag-and-drop com cálculo automático de macros + estimativa de custo em R$ por refeição (TACO + POF).",
  },
  {
    Icon: Smartphone,
    title: "App do paciente (PWA)",
    description:
      "Paciente registra refeições, água e peso. Funciona offline, instalável como app no celular. Sem app store.",
  },
  {
    Icon: CreditCard,
    title: "Pagamentos com split",
    description:
      "Cobra paciente via Pix/cartão. Plataforma retém apenas a fee acordada — você recebe automaticamente.",
  },
  {
    Icon: Trophy,
    title: "Gamificação real",
    description:
      "Streaks de aderência, achievements e vouchers de desconto. Engajamento ligado ao seu faturamento.",
  },
  {
    Icon: LineChart,
    title: "Antropometria com gráficos",
    description:
      "Protocolos Pollock 7/3, Jackson-Pollock, OMS pediátrico. Evolução visual de peso, IMC, dobras.",
  },
  {
    Icon: PackageOpen,
    title: "Migração assistida",
    description:
      "Importe pacientes do Dietbox/Webdiet com wizard de mapeamento. Não comece do zero.",
  },
];

export function Features() {
  return (
    <section
      id="funcionalidades"
      className="border-b border-border-subtle bg-bg-surface py-20"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Tudo que você precisa para atender bem
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Substitui agenda, prontuário, dieta e app paciente — em uma única
            conta.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, description }) => (
            <Card
              key={title}
              variant="interactive"
              className="transition-shadow"
            >
              <CardContent className="pt-6">
                <div
                  aria-hidden
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary"
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-text-primary">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
