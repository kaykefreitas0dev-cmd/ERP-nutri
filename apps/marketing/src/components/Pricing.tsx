"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";

interface PricingPlan {
  slug: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  features: {
    included?: string[];
    limits?: Record<string, number | null>;
  };
  is_featured: boolean;
  trial_days: number;
}

interface PricingProps {
  plans: PricingPlan[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function Pricing({ plans }: PricingProps) {
  const [isYearly, setIsYearly] = useState(true);

  if (plans.length === 0) {
    return (
      <section
        id="precos"
        className="border-b border-slate-100 bg-slate-50 py-20"
      >
        <Container>
          <p className="text-center text-sm text-slate-500">
            Preços temporariamente indisponíveis. Tente novamente em alguns
            minutos ou veja em{" "}
            <Link
              href="/contato"
              className="text-brand-primary hover:underline"
            >
              /contato
            </Link>
            .
          </p>
        </Container>
      </section>
    );
  }

  return (
    <section
      id="precos"
      className="border-b border-slate-100 bg-slate-50 py-20"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Planos transparentes, sem surpresas
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Comece grátis por {plans[0]?.trial_days ?? 14} dias. Sem cartão de
            crédito.
          </p>

          <div
            role="group"
            aria-label="Periodicidade"
            className="mt-8 inline-flex rounded-lg border border-slate-200 bg-white p-1"
          >
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              aria-pressed={!isYearly}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                !isYearly
                  ? "bg-brand-primary text-white"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              aria-pressed={isYearly}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isYearly
                  ? "bg-brand-primary text-white"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Anual <span className="ml-1 text-xs">(2 meses grátis)</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const priceCents = isYearly
              ? Math.round(plan.price_yearly_cents / 12)
              : plan.price_monthly_cents;
            const isFeatured = plan.is_featured;

            return (
              <Card
                key={plan.slug}
                className={`relative ${
                  isFeatured
                    ? "border-brand-primary shadow-lg ring-2 ring-brand-primary"
                    : ""
                }`}
              >
                {isFeatured && (
                  <Badge
                    variant="default"
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                  >
                    Mais escolhido
                  </Badge>
                )}
                <CardContent className="pt-6">
                  <h3 className="text-lg font-bold text-slate-900">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="mt-2 text-sm text-slate-600">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-6">
                    <span className="text-4xl font-bold text-slate-900">
                      {formatCurrency(priceCents)}
                    </span>
                    <span className="text-sm text-slate-500">/mês</span>
                    {isYearly && (
                      <p className="mt-1 text-xs text-slate-500">
                        Cobrado anualmente:{" "}
                        {formatCurrency(plan.price_yearly_cents)}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`https://erp-nutri-web.vercel.app/registro?plan=${plan.slug}&billing=${isYearly ? "yearly" : "monthly"}`}
                    className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                      isFeatured
                        ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
                        : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    Começar grátis
                  </Link>

                  {plan.features.included &&
                    plan.features.included.length > 0 && (
                      <ul className="mt-6 space-y-2 text-sm text-slate-700">
                        {plan.features.included.map((item: string) => (
                          <li key={item} className="flex items-start gap-2">
                            <svg
                              aria-hidden
                              className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Preços em reais (BRL). Cancela quando quiser. Sem multa.
        </p>
      </Container>
    </section>
  );
}
