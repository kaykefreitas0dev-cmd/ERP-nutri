import Link from "next/link";
import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { CircleCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata = {
  title: "Planos e Preços — NutriCore",
  description:
    "Planos transparentes para nutricionistas autônomos, clínicas e equipes. Sem fidelidade, sem taxa de setup, com 14 dias grátis.",
  alternates: { canonical: "/precos" },
  openGraph: {
    title: "Planos NutriCore — Nutricionistas conectados aos pacientes",
    description:
      "Comece grátis. Cobre o paciente como já cobra hoje (PIX, cartão), nós cuidamos do plano alimentar e do acompanhamento.",
    type: "website",
  },
};

interface PublicPlan {
  slug: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  features: Record<string, unknown>;
  is_featured: boolean;
  trial_days: number;
}

async function fetchPlans(): Promise<PublicPlan[]> {
  try {
    const url =
      process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://erp-nutri-web.vercel.app";
    const res = await fetch(`${url}/api/v1/public/pricing-plans`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PublicPlan[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

function fmtBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const FALLBACK_PLANS: PublicPlan[] = [
  {
    slug: "solo",
    name: "Solo",
    description: "Para o nutricionista autônomo começando.",
    price_monthly_cents: 4990,
    price_yearly_cents: 49900,
    features: {
      patients: "Até 50 pacientes ativos",
      meal_plans: "Editor de plano com TACO/POF",
      booking: "Página pública de agendamento",
      patient_app: "PWA do paciente (check-in, plano)",
      documents: "Atestados, receitas, recibos PDF",
      support: "Suporte por email (resposta em 48h)",
    },
    is_featured: false,
    trial_days: 14,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Para nutricionistas com prática estabelecida.",
    price_monthly_cents: 9990,
    price_yearly_cents: 99900,
    features: {
      patients: "Pacientes ilimitados",
      meal_plans: "Editor de plano + receitas custom + custeio",
      booking: "Booking + integração Google Calendar",
      patient_app: "PWA + lembretes automáticos",
      documents: "Documentos clínicos + CID-10 + assinatura",
      multi_clinic: "Múltiplos consultórios",
      support: "Suporte prioritário (resposta em 24h)",
    },
    is_featured: true,
    trial_days: 14,
  },
  {
    slug: "clinic",
    name: "Clínica",
    description: "Equipes de 3+ profissionais.",
    price_monthly_cents: 19990,
    price_yearly_cents: 199900,
    features: {
      patients: "Pacientes ilimitados (por profissional)",
      team: "Equipe ilimitada + papéis (owner/admin/nutri)",
      branding: "Branding customizável (logo, cores)",
      reports: "Relatórios gerenciais",
      api: "API para integração",
      support: "Suporte dedicado + onboarding",
    },
    is_featured: false,
    trial_days: 14,
  },
];

export default async function PrecosPage() {
  const fetched = await fetchPlans();
  const plans = fetched.length > 0 ? fetched : FALLBACK_PLANS;

  return (
    <>
      <SiteHeader />
      <main className="bg-bg-page py-12">
        <Container size="lg">
          <header className="text-center">
            <Badge variant="default">
              <Sparkles className="h-3 w-3" strokeWidth={2} /> 14 dias grátis
            </Badge>
            <h1 className="mt-4 text-h1 font-bold tracking-tight text-text-primary sm:text-4xl">
              Planos transparentes
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-body text-text-secondary">
              Sem fidelidade, sem taxa de setup. Cobra o paciente como já cobra
              hoje (PIX, cartão) — a gente cuida do plano alimentar e do
              acompanhamento.
            </p>
          </header>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => {
              const featured = p.is_featured;
              const features =
                (p.features as Record<string, string> | null) ?? {};
              return (
                <Card
                  key={p.slug}
                  className={
                    featured ? "relative ring-2 ring-brand-primary" : "relative"
                  }
                >
                  {featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="default">Mais popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h2 className="text-h2 font-semibold text-text-primary">
                      {p.name}
                    </h2>
                    {p.description && (
                      <p className="mt-1 text-caption text-text-secondary">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-h1 font-bold text-text-primary tabular-nums">
                          {fmtBRL(p.price_monthly_cents)}
                        </span>
                        <span className="text-caption text-text-secondary">
                          /mês
                        </span>
                      </div>
                      <p className="mt-1 text-tiny text-text-muted tabular-nums">
                        ou {fmtBRL(p.price_yearly_cents)}/ano ({" "}
                        {Math.round(
                          (1 -
                            p.price_yearly_cents /
                              (p.price_monthly_cents * 12)) *
                            100,
                        )}
                        % off)
                      </p>
                    </div>

                    <Link
                      href={`/signup?plan=${p.slug}`}
                      className={`mt-6 flex w-full items-center justify-center rounded-md px-4 py-2.5 text-caption font-medium transition-colors ${featured ? "bg-brand-primary text-white hover:bg-brand-primary-hover" : "border border-border-default bg-bg-surface text-text-primary hover:bg-bg-subtle"}`}
                    >
                      Começar grátis ({p.trial_days} dias)
                    </Link>

                    <ul className="mt-6 space-y-2.5">
                      {Object.entries(features).map(([key, value]) => (
                        <li
                          key={key}
                          className="flex items-start gap-2 text-caption text-text-secondary"
                        >
                          <CircleCheck
                            className="mt-0.5 h-4 w-4 shrink-0 text-success"
                            strokeWidth={1.75}
                          />
                          <span>{value}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <section className="mt-16">
            <h2 className="text-h2 font-semibold text-text-primary">
              Perguntas frequentes
            </h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  q: "Posso cancelar a qualquer momento?",
                  a: "Sim. Sem fidelidade. Você cancela direto no app e mantém acesso até o fim do ciclo já pago.",
                },
                {
                  q: "Como funciona o trial de 14 dias?",
                  a: "Você usa tudo do plano escolhido sem cartão. No 15º dia pedimos o cartão para continuar. Se não cadastrar, a conta vira somente-leitura por 7 dias até excluir.",
                },
                {
                  q: "A NutriCore recebe o pagamento dos meus pacientes?",
                  a: "Não no MVP. Você cobra como já cobra (PIX, Asaas, etc.) e registra na plataforma. A cobrança via NutriCore (com split + escrow) chega em uma fase futura.",
                },
                {
                  q: "Meus dados ficam onde?",
                  a: "Banco Postgres + Supabase em São Paulo (sa-east-1). Backups diários em Cloudflare R2 (também BR). Conformidade LGPD + CFN 599/2018 + Lei 13.787/2018.",
                },
                {
                  q: "Posso importar pacientes de outras plataformas?",
                  a: "Sim. Importação via CSV (até 5.000 linhas por arquivo). Templates prontos para Dietbox, Webdiet e custom.",
                },
              ].map((item) => (
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
            <p className="mt-6 text-center text-caption text-text-secondary">
              Mais dúvidas?{" "}
              <Link
                href="/faq"
                className="font-medium text-brand-primary hover:underline"
              >
                Veja todas as perguntas →
              </Link>
            </p>
          </section>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
