import Link from "next/link";
import { Container } from "@repo/ui/container";
import { Badge } from "@repo/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border-subtle bg-gradient-to-b from-brand-primary-bg via-white to-white py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="default" className="mb-6">
            🇧🇷 Feito para nutricionistas brasileiros
          </Badge>

          <h1 className="text-balance text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl">
            Toda sua clínica de nutrição em{" "}
            <span className="text-brand-primary">uma única plataforma</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-text-secondary">
            Agenda, prontuário, planos alimentares com custeio em R$, lembretes
            via WhatsApp e app PWA do paciente. Pensado para o profissional
            autônomo e clínicas multi-profissionais.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/#precos"
              className="inline-flex h-12 items-center justify-center rounded-md bg-brand-primary px-8 text-base font-medium text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              Começar grátis (14 dias)
            </Link>
            <Link
              href="/#funcionalidades"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border-default bg-white px-8 text-base font-medium text-text-secondary hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              Ver funcionalidades
            </Link>
          </div>

          <p className="mt-6 text-sm text-text-muted">
            Sem cartão de crédito • LGPD compliant • Dados em São Paulo
          </p>
        </div>

        {/* Social proof - placeholder até PM ter logos reais */}
        <div className="mt-16 border-t border-border-subtle pt-10">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
            Construído seguindo padrões de
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-text-subtle">
            <span>CFN 599/2018</span>
            <span aria-hidden>•</span>
            <span>Lei 13.787/2018</span>
            <span aria-hidden>•</span>
            <span>LGPD</span>
            <span aria-hidden>•</span>
            <span>Tabela TACO 4ª ed</span>
            <span aria-hidden>•</span>
            <span>IBGE POF</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
